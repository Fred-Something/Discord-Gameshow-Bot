const { Client, GatewayIntentBits, Partials, DMChannel } = require('discord.js');
const { token } = require('./config.json');
const fs = require('fs');

// Read alphabet from file
var alphabet = new Array;
fs.readFile('./alphabet.txt', 'utf-8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    alphabet = data.split('\n');
})

// Read keywords from file
var words = new Array;
    fs.readFile('./words.txt', 'utf-8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    words = data.split('\n');
})

const client = new Client({
    intents: [
    GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Channel,
        Partials.Message
    ]
});

// Checks for and records unread submitted votes, notifies the submitter if their vote has an error
async function harvestVotes(message, guildId) {
    const data = require('./data/' + guildId + '_data.json');

    const guild = client.guilds.cache.get(message.guild.id);
    let res = await guild.members.fetch();

    const mostRecent = data.lastmessage;
    var memberNum = 0;

    // Iterate over every server member
    for (const memberdata of res) {
        const member = memberdata[1];
        memberNum++;

        // Skip bots
        if (member.user.bot || member.id == "1127381458986750043") continue;

        // Check if the user has sent any DMs
        var dmChannel;
        try {
            dmChannel = await member.createDM();
        }
        catch {
            console.log("Could not create DM with id " + member.id + " (" + member.user.username + ")");
            continue;
        }
        const lastMessageId = dmChannel.lastMessageId;
        if (lastMessageId === undefined) continue;

        // Check if the most recent DM is more recent than last harvest, and check votes if so
        if (mostRecent < lastMessageId) {

            // Get the last 20 messages sent to the bot
            const recentMessages = await dmChannel.messages.fetch({ limit: 20 });
            if (dmChannel.lastMessage.author.bot) continue;

            // Filters out all older messages, as well as all messages sent by the bot itself
            const filteredMessages = recentMessages.filter(message => {
                return (message.id > mostRecent) && !message.author.bot && (member.id !== "1127381458986750043");
            }).reverse();

            // Iterate through all remaining messages, recording all votes sent
            if (filteredMessages.size > 0) {
                var votes = new Array;
                var num = 0;
                filteredMessages.map(message2 => {
                    // Read every line of a message
                    const lines = message2.content.split('\n');
                    for (var line in lines) {
                        // Log all messages sent to the bot so I can manually fix any mistakes if they should happen
                        console.log(member.user.username + ": " + lines[line]);
                        const split = lines[line].split(" ");

                        // Votes should only consist of 2 words, so lines with more than 2 words should be skipped 
                        if (split.length == 2) {
                            votes[num] = lines[line];
                            num++;
                        }
                    }
                }
                )

                // Record all read votes
                if (num > 2) recordVotes(votes, guildId, dmChannel.lastMessage);
            }
        }
    }  

    console.log("Loop finished: " + memberNum + " members");

    // Store the new most recent message to use for future harvests
    data.lastmessage = message.id;
    saveData(data, guildId);
}

// Checks for and records unread submitted responses
async function harvest(message, guildId, technical) {
    const data = require('./data/' + guildId + '_data.json');

    const guild = client.guilds.cache.get(message.guild.id);
    let res = await guild.members.fetch();

    const mostRecent = data.lastmessage;
    var num2 = 0;

    // Iterate over every server member that isn't a bot
    for (const memberdata of res) {
        const member = memberdata[1];
        num2++;
        if (member.user.bot || member.id === "1127381458986750043") continue;

        // Check if the user has sent any DMs
        var dmChannel;
        try {
            dmChannel = await member.createDM();
        }
        catch {
            console.log("Could not create DM with id " + member.id + " (" + member.user.username + ")");
            continue;
        }
        const lastMessageId = dmChannel.lastMessageId;
        if (lastMessageId === undefined) continue;

        // Check DM is more recent than last harvest, and edit response if so
        if (mostRecent < lastMessageId) {
            const recentMessages = await dmChannel.messages.fetch({ limit: 10 });
            try {
                if (dmChannel.lastMessage.author.bot) continue;
            }
            catch {
                console.log('dmChannel lastMessage issue\n' + dmChannel.lastMessage);
                continue;
            }
            const filteredMessages = recentMessages.filter(message => {
                return (message.id > mostRecent) && !message.author.bot && (member.id !== "1127381458986750043");
            }).reverse();
            if (filteredMessages.size > 0) {
                var responses = new Array;
                var messageLinks = new Array;
                filteredMessages.map(async (message2) => {
                    const lines = message2.content.split('\n');
                    for (const content in lines) {
                        console.log(member.user.username + ": " + lines[content]);
                        const split = lines[content].split(':');
                        if (split.length === 1) {
                            responses[0] = lines[content];
                            messageLinks[0] = message2;
                        }
                        else if (!isNaN(parseInt(split[0]))) {
                            if (parseInt(split[0]) < 10) {
                                var word = lines[content].slice(2);
                                if (word.charAt(0) === ' ') word = word.slice(1);
                                responses[parseInt(split[0]) - 1] = word;
                                messageLinks[parseInt(split[0]) - 1] = message2;
                            }
                        }
                        else if (lines[content] !== "") {
                            responses[0] = lines[content];
                            messageLinks[0] = message2;
                        }
                    }
                });
                for (i = 0; i < responses.length; i++) {
                    if (responses[i] !== undefined) await recordResponse(responses[i], i, guildId, messageLinks[i], technical);
                }
            }
        }
    };

    console.log("Loop finished: " + num2 + " members");

    data.lastmessage = message.id;
    saveData(data, guildId);
    return;
}

// Chacks if 
async function recordResponse(message, num, guild, messageLink, technical) {
    // Get the list of banned words from the round 4 twist
    const banlist = require('./data/banlist.json');

    // Get the list of words banned for this specific contestant
    const userbanlist = banlist[messageLink.author.globalName];

    if (userbanlist !== undefined) {
        // Remove all punctuation except ', set all letters to lowercase and provide a list of the words
        words = message.toLowerCase().replace('’', "'").replace(/[^\w\s\']/g, "").replace(/\s+/g, " ").split(' ');

        // Reject the response if it uses a banned word
        for (const word in userbanlist) 
        {
            if (words.includes(userbanlist[word])) {
                messageLink.channel.send("Unfortunately, your response `" + message + "` contains banned word from round 4: " + userbanlist[word] + "\nIf you believe this word should not be banned let Fred know. Remember that contractions and alternate forms counted as the same words");
                console.log(messageLink.channel.send("War: Unfortunately, your response `" + message + "` contains banned word from round 4: " + userbanlist[word] + "\nIf you believe this word should not be banned let Fred know. Remember that contractions and alternate forms counted as the same words"));
                return;
            }
        }
    }

    // Fetch response file
    const responses = require('./data/' + guild + '_responses.json');

    // If new response is identical to the current response by the contestant, do nothing
    if (responses[messageLink.author.globalName + " [" + (num + 1) + "]"] === message) return;

    // Chech the response passes the given technical (the default technical 'pass' will always pass)
    const tech = require('./technicals/' + technical + '.js');
    const out = tech.check(message, num);

    // If the response passes the technical, record it
    if (out.pass) {
        responses[messageLink.author.globalName + " [" + (num + 1) + "]"] = message;

        saveResponses(responses, guild);
        console.log('Response recorded from ' + messageLink.author.username);
    }

    // Notify the contestant that their response has been accepted/rejected
    console.log("WAR: " + out.output);
    messageLink.channel.send(out.output);
}

// Check all votes for errors and record them
function recordVotes(votesData, guild, messageLink) {
    // Fetch vote file and screen file
    const votes = require('./data/' + guild + '_votes.json');
    const screens = require('./data/' + guild + '_screens.json');
    var out = ''

    // Multiple votes can be recorded at once
    for (var vote in votesData) { 
        var content = votesData[vote];
        // Remove square brackets if present
        content = content.replace('[', '').replace(']', '');
        const split = content.split(' ');

        // If the vote is identical to an existing vote by the same voter, do nothing
        if (votes[messageLink.author.username + " [" + split[0] + "]"] === content) return;

        // Check the voting screen exists
        if (screens[split[0]] !== undefined) {
            var letters = new Array;
            var valid = true;

            // Check if the vote is missing any letters
            for (var lett in screens[split[0]]) {
                if (!split[1].includes(lett)) {
                    valid = false;
                    console.log("WAR: " + split[0] + ' missing letter: ' + lett);
                    messageLink.channel.send(split[0] + ' missing letter: ' + lett);
                }
            }

            // Check if the vote has any duplicate letters
            for (var lett in split[1]) {
                if (letters.includes(split[1].charAt(lett))) {
                    valid = false;
                    console.log("WAR: " + split[0] + ' has duplicate letter: ' + split[1].charAt(lett));
                    messageLink.channel.send(split[0] + ' has duplicate letter: ' + split[1].charAt(lett));
                }
                letters.push(split[1].charAt(lett));
            }

            // Tell the voter their vote has been recorded if it is valid
            if (valid) {
                out += 'Vote recorded on screen ' + split[0] + '\n'
            }
        }
        else {
            console.log("WAR: " + 'Screen ' + split[0] + ' does not exist');
            messageLink.channel.send('Screen ' + split[0] + ' does not exist');
        }

        // Invalid votes will be recorded too because often I can fix them manually (eg, the screen name was just spelt wrong)
        console.log('Vote recorded from ' + messageLink.author.username);
        votes[messageLink.author.username + " [" + split[0] + "]"] = content;        
    }

    saveVotes(votes, guild);

    if (out !== '') {
        console.log("WAR: " + out + 'Votes recorded, thanks for voting!');
        messageLink.channel.send(out + 'Votes recorded, thanks for voting!');
    }
}

// Save the given data in the given server's data file
function saveData(data, guild) {
    fs.writeFile('./data/' + guild + '_data.json', JSON.stringify(data), {flag: 'w+'}, err => {
        if (err) {
          console.error(err);
        }
    });
}

// Save the given responses in the given server's response file
function saveResponses(responses, guild) {
    fs.writeFile('./data/' + guild + '_responses.json', JSON.stringify(responses), {flag: 'w+'}, err => {
        if (err) {
          console.error(err);
        }
    });
}

// Save the given votes in the given server's vote file
function saveVotes(votes, guild) {
    fs.writeFile('./data/' + guild + '_votes.json', JSON.stringify(votes), {flag: 'w+'}, err => {
        if (err) {
          console.error(err);
        }
    });
}

// Print the entire response file in a format I can easily copy into my voting calculator
function printResponses(message, guild) {
    const responses = require('./data/' + guild + '_responses.json');
    var num = 0;
    var out = "\n"
    for (var contestant in responses) {
        num++;
        const name = contestant.toString();
        out += name.slice(0, name.length - 4) + ' | ' + responses[contestant] + '\n';
    }

    if (out.length < 1900) message.channel.send('```\n(' + num + ' responses)' + out + '```');
    else message.channel.send('Responses printed in output.txt');
    fs.writeFile('./output.txt', '(' + num + ' responses)' + out, {flag: 'w+'}, err => {
        if (err) {
          console.error(err);
        }
    });
}

// Print the entire vote file in a format I can easily copy into my voting calculator
async function printVotes(message, guild) {
    const responses = require('./data/' + guild + '_votes.json');
    var num = 0;
    var out = "\n"
    for (var contestant in responses) {
        num++;
        var name = contestant.toString();
        const split = name.split(" ");
        name = split.slice(0, -1).join(' ');
        out += name + ' | ' + responses[contestant] + '\n';
    }

    if (out.length < 1900) message.channel.send('```\n(' + num + ' votes)' + out + '```');
    else message.channel.send('Votes printed in output.txt');

    fs.writeFile('./output.txt', out, {flag: 'w+'}, err => {
        if (err) {
          console.error(err);
        }
    });
}

// Make a voting screen with a given number of sections, and a given minum number of responses per screen
async function makeVotingScreens(message, sections, guild, min) {

    // Initialise list of responses, screen words, and necessary values
    const responsesJSON = require('./data/' + guild + '_responses.json');
    screenwords = words;
    shuffleArray(screenwords);
    var num = 0;
    var screens = 1;
    var out = {};
    var responses = new Array;
    for (var contestant in responsesJSON) {
        responses[num] = responsesJSON[contestant]
        num++;
    }

    // Generate sections
    for (let i = 0; i < sections; i++) {
        shuffleArray(responses);

        // Calculate the number of screens needed in this section
        // Earlier sections will have larger screens
        if (Math.floor(num / (i + 1)) >= min) {
            screens = i + 1;
        }
        else {
            screens = Math.floor(num / min);
            if (screens === 0) screens = 1;
        }

        // Generate screens for this section
        var count = 0;
        for (let j = 0; j < screens; j++) {
            var screen = {};
            for (let k = 0; k < Math.ceil((num / screens) - (j / screens)); k++) {
                screen[alphabet[k].slice(0,-1)] = responses[count];
                count++;
            }
            out[screenwords[0].slice(0,-1)] = screen;
            screenwords.shift();
        }
    }

    // Save the voting screen
    fs.writeFile('./data/' + guild + '_screens.json', JSON.stringify(out), {flag: 'w+'}, err => {
        if (err) {
          console.error(err);
        }
    });

    outputVotingScreens(out);

    message.channel.send('Screens printed in output.txt');
}

// Translate the voting screens into a format that I can copy into my voting calculator
function outputVotingScreens(out) {
    var text = ''

    for (var screen in out) {
        text += screen + '\n';
        for (var letter in out[screen]) {
            text += letter + ' | ' + out[screen][letter] + '\n';
        }
        text += '\n';
    }

    fs.writeFile('./output.txt', text, {flag: 'w+'}, err => {
        if (err) {
          console.error(err);
        }
    });
}

const prefix = '-w'

client.once('ready', () => {
    console.log('restarted');
})

client.on('messageCreate', async message => {
    // Ignore all messages not sent by me, and messages that aren't bot commands
    if(!(message.content.startsWith(prefix) && message.author.username === "fredsomething")) return;

    // Get the command name
    const args = message.content.slice(prefix.length).split(' ');
    if (args[0] === '') {args.shift()}
    const com = args[0];
    const guild = message.guildId
   
    if (com === "harvest") {
        message.channel.send('Harvesting responses...');
        const time = new Date();
        if (args.length > 1) {
            await harvest(message, guild, args[1]);
        }
        else {
            await harvest(message, guild, 'pass');
        }
        message.channel.send('Harvesting complete in ' + (new Date() - time) + 'ms');
    }
    else if (com === "hvotes" || com === "harvestvotes") {
        message.channel.send('Harvesting votes...');
        const time = new Date();
        await harvestVotes(message, guild);
        message.channel.send('Vote harvesting complete in ' + (new Date() - time) + 'ms');
    }
    else if (com === "responses") {
        printResponses(message, guild);
    }
    else if (com === "votes") {
        printVotes(message, guild);
    }
    else if (com === "clear") {
        // Clear the recorded responses and votes, update the last read message
        fs.writeFile('./data/' + guild + '_responses.json', '{}', {flag: 'w'}, err => {
            if (err) {
              console.error(err);
            }
        });
        fs.writeFile('./data/' + guild + '_votes.json', '{}', {flag: 'w'}, err => {
            if (err) {
              console.error(err);
            }
        });
        const data = {lastmessage: message.id}
        saveData(data, guild);
        message.channel.send('Cleared');
    }
    else if (com === "generate") {
        // Generate voting screens from responses
        if (args.length > 1) {
            if (args.length > 2) {
                makeVotingScreens(message, parseInt(args[1]), guild, parseInt(args[2]));
            }
            else {
                makeVotingScreens(message, parseInt(args[1]), guild, 10);
            }
        }
        else {
            makeVotingScreens(message, 1, guild, 10);
        }
    }
    else if (com === "setup") {
        // Initialise necessary files for a new server
        fs.writeFile('./data/' + guild + '_responses.json', '{}', {flag: 'w+'}, err => {
            if (err) {
              console.error(err);
            }
        });
        fs.writeFile('./data/' + guild + '_votes.json', '{}', {flag: 'w+'}, err => {
            if (err) {
              console.error(err);
            }
        });
        fs.writeFile('./data/' + guild + '_data.json', '{"lastmessage":"1140044512715091988"}', {flag: 'w+'}, err => {
            if (err) {
              console.error(err);
            }
        });
        message.channel.send('Setup complete! Server ' + guild);
    }
    else {
        console.log(com);
    }
})

// Randomise the order of an array
function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

client.login(token);