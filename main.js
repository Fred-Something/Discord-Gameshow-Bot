const { Client, GatewayIntentBits, Partials, DMChannel } = require('discord.js');
const { token } = require('./config.json');
//https://discord.com/api/oauth2/authorize?client_id=1127381458986750043&permissions=268437504&scope=bot

const fs = require('fs');

var alphabet = new Array;
fs.readFile('./alphabet.txt', 'utf-8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    alphabet = data.split('\n');
})
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

async function harvestVotes(message, guildId) {
    const time = new Date();
    const data = require('./data/' + guildId + '_data.json');

    const guild = client.guilds.cache.get(message.guild.id);
    let res = await guild.members.fetch();

    const mostRecent = data.lastmessage;

    // Iterate over every server member that isn't a bot
    res.forEach(async (member) => {
        if (member.bot || member.id == 1127381458986750043n) return;

        // Check if the user has sent any DMs
        const dmChannel = await member.createDM();
        const lastMessageId = dmChannel.lastMessageId;
        if (lastMessageId === undefined) return;

        // Check DM is more recent than last harvest, and edit response if so
        if (mostRecent < lastMessageId) {
            const recentMessages = await dmChannel.messages.fetch({ limit: 20 });
            const filteredMessages = recentMessages.filter(message => {
                return (message.id > mostRecent) && !message.author.bot;
            }).reverse();
            if (filteredMessages.size > 0) {
                var votes = new Array;
                var num = 0;
                filteredMessages.map(message2 => {
                    const lines = message2.content.split('\n');
                    for (var line in lines) {
                        const split = lines[line].split(" ");
                        if (split.length == 2) {
                            votes[num] = lines[line];
                            num++;
                        }
                    }
                }
                )
                recordVotes(votes, guildId, dmChannel.lastMessage);
            }
        }
    }  
    )
    data.lastmessage = message.id;
    saveData(data, guildId);

    message.channel.send('Harvesting complete in ' + (new Date() - time) + 'ms');
}

async function harvest(message, guildId, technical) {
    const time = new Date();
    const data = require('./data/' + guildId + '_data.json');

    const guild = client.guilds.cache.get(message.guild.id);
    let res = await guild.members.fetch();

    const mostRecent = data.lastmessage;

    // Iterate over every server member that isn't a bot
    res.forEach(async (member) => {
        console.log(member.username);
        if (member.bot || member.id == 1127381458986750043) return;

        // Check if the user has sent any DMs
        const dmChannel = await member.createDM();
        const lastMessageId = dmChannel.lastMessageId;
        if (lastMessageId === undefined) return;

        // Check DM is more recent than last harvest, and edit response if so
        if (mostRecent < lastMessageId) {
            const recentMessages = await dmChannel.messages.fetch({ limit: 10 });
            const filteredMessages = recentMessages.filter(message => {
                return (message.id > mostRecent) && !message.author.bot;
            }).reverse();
            if (filteredMessages.size > 0) {
                var responses = new Array;
                var messageLinks = new Array;
                filteredMessages.map(async message2 => {
                    const lines = message2.content.split('\n');
                    for (const content in lines) {
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
    });

    data.lastmessage = message.id;
    saveData(data, guildId);

    message.channel.send('Harvesting complete in ' + (new Date() - time) + 'ms');
}

async function recordResponse(message, num, guild, messageLink, technical) {
    const tech = require('./technicals/' + technical + '.js');
    const out = tech.check(message);
    if (out === 'pass') {
        const responses = require('./data/' + guild + '_responses.json');

        responses[messageLink.author.username + " [" + (num + 1) + "]"] = message;

        saveResponses(responses, guild);

        messageLink.channel.send('Response **' + (num + 1) + '** recorded: ' + message + 
            '\nIf you want to edit your response, simply send another message. Remember to **only include your response in the message, nothing else**');
    }
    else {
        messageLink.channel.send('Whoops! Your response:\n' + message + '\ndoes not pass the technical:\n' + out);
    }
}

function recordVotes(votesData, guild, messageLink) {
    const votes = require('./data/' + guild + '_votes.json');
    const screens = require('./data/' + guild + '_screens.json');
    var out = ''

    for (var vote in votesData) { 
        var content = votesData[vote];
        content = content.replace('[', '').replace(']', '');
        const split = content.split(' ');

        if (screens[split[0]] !== undefined) {
            var letters = new Array;
            var valid = true;

            for (var lett in screens[split[0]]) {
                if (!split[1].includes(lett)) {
                    valid = false;
                    messageLink.channel.send(split[0] + ' missing letter: ' + lett);
                }
            }

            for (var lett in split[1]) {
                if (letters.includes(split[1].charAt(lett))) {
                    valid = false;
                    messageLink.channel.send(split[0] + ' has duplicate letter: ' + split[1].charAt(lett));
                }
                letters.push(split[1].charAt(lett));
                console.log(letters);
            }

            if (valid) {
                out += 'Vote recorded on screen ' + split[0] + '\n'
                
            }
        }
        else {
            messageLink.channel.send('Screen ' + split[0] + ' does not exist');
        }

        votes[messageLink.author.username + " [" + split[0] + "]"] = content;        
    }

    saveVotes(votes, guild);

    if (out !== '') messageLink.channel.send(out + 'Votes recorded, thanks for voting!');
}

function saveData(data, guild) {
    fs.writeFile('./data/' + guild + '_data.json', JSON.stringify(data), {flag: 'w+'}, err => {
        if (err) {
          console.error(err);
        }
    });
}

function saveResponses(responses, guild) {
    fs.writeFile('./data/' + guild + '_responses.json', JSON.stringify(responses), {flag: 'w+'}, err => {
        if (err) {
          console.error(err);
        }
    });
}

function saveVotes(votes, guild) {
    fs.writeFile('./data/' + guild + '_votes.json', JSON.stringify(votes), {flag: 'w+'}, err => {
        if (err) {
          console.error(err);
        }
    });
}

function printResponses(message, guild) {
    const responses = require('./data/' + guild + '_responses.json');
    var num = 0;
    var out = "\n"
    for (var contestant in responses) {
        num++;
        const name = contestant.toString();
        out += name.slice(0, name.length - 4) + ' | ' + responses[contestant] + '\n';
    }

    message.channel.send('```\n(' + num + ' responses)' + out + '```');
}

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

    message.channel.send('```\n(' + num + ' votes)' + out + '```');
}

async function makeVotingScreens(message, sections, guild, min) {
    const responsesJSON = require('./data/' + guild + '_responses.json');
    shuffleArray(words);
    var num = 0;
    var screens = 1;
    var out = {};
    var responses = new Array;
    for (var contestant in responsesJSON) {
        responses[num] = responsesJSON[contestant]
        num++;
    }

    for (let i = 0; i < sections; i++) {
        shuffleArray(responses);

        if (Math.floor(num / (i + 1)) >= min) {
            screens = i + 1;
        }
        else {
            screens = Math.floor(num / min);
            if (screens === 0) screens = 1;
        }

        var count = 0;
        for (let j = 0; j < screens; j++) {
            var screen = {};
            for (let k = 0; k < Math.ceil((num / screens) - (j / screens)); k++) {
                screen[alphabet[k].slice(0,-1)] = responses[count];
                count++;
            }
            out[words[0].slice(0,-1)] = screen;
            words.shift();
        }
    }

    fs.writeFile('./data/' + guild + '_screens.json', JSON.stringify(out), {flag: 'w+'}, err => {
        if (err) {
          console.error(err);
        }
    });

    outputVotingScreens(out);

    message.channel.send('!');
}

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

client.on('messageCreate', message => {
    if(!(message.content.startsWith(prefix) && message.author.username === "fredsomething")) return;
    const args = message.content.slice(prefix.length).split(' ');
    if (args[0] === '') {args.shift()}
    const com = args[0];
    const guild = message.guildId
   
    if (com === "harvest") {
        if (args.length > 1) {
            harvest(message, guild, args[1]);
        }
        else {
            harvest(message, guild, 'pass');
        }
    }
    else if (com === "hvotes" || com === "harvestvotes") {
        harvestVotes(message, guild);
    }
    else if (com === "responses") {
        printResponses(message, guild);
    }
    else if (com === "votes") {
        printVotes(message, guild);
    }
    else if (com === "clear") {
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
        const data = require('./data/' + guild + '_data.json');
        data.lastmessage = message.id;
        saveData(data, guild);
        message.channel.send('Cleared');
    }
    else if (com === "generate") {
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

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

client.login(token);