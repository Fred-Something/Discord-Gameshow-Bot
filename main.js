const { Client, GatewayIntentBits, Partials, DMChannel } = require('discord.js');
const { token } = require('./config.json');

const fs = require('fs');

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
        if (member.bot || member.id == 1127381458986750043n) return;

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

    for (var vote in votesData) { 
        var content = votesData[vote];
        content = content.replace('[', '').replace(']', '');
        const split = content.split(' ');

        votes[messageLink.author.username + " [" + split[0] + "]"] = content;
    }

    saveVotes(votes, guild);

    messageLink.channel.send('Votes recorded, thanks for voting!');
}

function saveData(data, guild) {
    fs.writeFile('./data/' + guild + '_data.json', JSON.stringify(data), {flag: 'w'}, err => {
        if (err) {
          console.error(err);
        }
    });
}

function saveResponses(responses, guild) {
    fs.writeFile('./data/' + guild + '_responses.json', JSON.stringify(responses), {flag: 'w'}, err => {
        if (err) {
          console.error(err);
        }
    });
}

function saveVotes(votes, guild) {
    fs.writeFile('./data/' + guild + '_votes.json', JSON.stringify(votes), {flag: 'w'}, err => {
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

function printVotes(message, guild) {
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
    else if (com == 'clear') {
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
    else if (com == "setup") {
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

 // if (com === "echo") {
//     if (args.length > 1) {
//         args.shift();
//         message.channel.send(args.join(" "));
//     }
//     else {
//         message.channel.send("Error: Send something to echo");
//     }
// }

client.login(token);