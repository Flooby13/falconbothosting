const Discord = require('discord.js')
const { read } = require('fs')
const client = new Discord.Client()
const ytdl = require('ytdl-core');
const config = require('./config.json')

const { YTSearcher } = require('ytsearcher');

const searcher = new YTSearcher({
    key: process.env.youtube_api,
    revealed : true
});


const queue = new Map();

client.on('ready', () => {
    console.log("Connected as " + client.user.tag)

    client.user.setActivity("-help", {type: "LISTENING"})

    client.guilds.cache.forEach((guild) => {
        console.log(guild.name)
        guild.channels.cache.forEach((channel) => {
            console.log(` - ${channel.name} ${channel.type} ${channel.id}`)
        })
        // General channel id: 786643989814050876
    })

    let generalChannel = client.channels.cache.get("786643989814050876")
    generalChannel.send("Falcon Bot is now online! Use -help to get my list of commands! :3")

})

client.on("message", async(message) => {
    const prefix = '!';
 
    const serverQueue = queue.get(message.guild.id);
 
    const args = message.content.slice(prefix.length).trim().split(/ +/g)
    const command = args.shift().toLowerCase();
 
    switch(command){
        case 'play':
            execute(message, serverQueue);
            break;
        case 'stop':
            stop(message, serverQueue);
            break;
        case 'skip':
            skip(message, serverQueue);
            break;
        case 'pause':
            pause(serverQueue)
            break;
        case 'resume':
            resume(serverQueue)
            break;
        case 'loop':
            Loop(args, serverQueue)
            break;
        case 'queue':
            Queue(serverQueue)
            break;
    }
 
    async function execute(message, serverQueue){
        let vc = message.member.voice.channel;
        if(!vc){
            return message.channel.send("Please join a voice chat first");
        }else{
            let result = await searcher.search(args.join(" "), { type: "video" })
            const songInfo = await ytdl.getInfo(result.first.url)
 
            let song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url
            };
 
            if(!serverQueue){
                const queueConstructor = {
                    txtChannel: message.channel,
                    vChannel: vc,
                    connection: null,
                    songs: [],
                    volume: 10,
                    playing: true,
                    loopone: false,
                    loopall: false,
                };
                queue.set(message.guild.id, queueConstructor);
 
                queueConstructor.songs.push(song);
 
                try{
                    let connection = await vc.join();
                    queueConstructor.connection = connection;
                    play(message.guild, queueConstructor.songs[0]);
                }catch (err){
                    console.error(err);
                    queue.delete(message.guild.id);
                    return message.channel.send(`Unable to join the voice chat ${err}`)
                }
            }else{
                serverQueue.songs.push(song);
                return message.channel.send({embed: {
                    color: 3447003,
                    author: {
                        name: '',
                        icon_url: '',
                    },
                    description: (`Queueing ${song.title} | [<@!${message.author.id}>]
                     **NOTE THERE MAY BE A DELAY.**`),
                    }
                });
            }
        }
    }
    function play(guild, song){
        const serverQueue = queue.get(guild.id);
        if(!song){
            serverQueue.vChannel.leave();
            queue.delete(guild.id);
            return;
        }
        const dispatcher = serverQueue.connection
            .play(ytdl(song.url))
            .on('finish', () =>{
                if(serverQueue.loopone){
                    play(guild, serverQueue.songs[0]);
                }
                else if(serverQueue.loopall){
                    serverQueue.songs.push(serverqueue.songs[0])
                    serverQueue.songs.shift()
                }else{
                    serverQueue.songs.shift()
                }
                play(guild, serverQueue.songs[0]);
            })
            message.channel.send({embed: {
                color: 3447003,
                author: {
                    name: '',
                    icon_url: '',
                },
                description: (`Now playing ${song.title} | [<@!${message.author.id}>]
                 **NOTE THERE MAY BE A DELAY.**`),
                url: (song.url),
                }
            });

    }
    function stop (message, serverQueue){
        if(!message.member.voice.channel)
            return message.channel.send("You need to join the voice chat first!")
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
    }
    function skip (message, serverQueue){
        if(!message.member.voice.channel)
            return message.channel.send("You need to join the voice chat first");
        if(!serverQueue)
            return message.channel.send("There is nothing to skip!");
        serverQueue.connection.dispatcher.end();
    }
    function pause(serverQueue){
        if(!serverQueue.connection)
            return message.channel.send("There isn't any music playing...");
        if(!message.member.voice.channel)
            return message.channel.send("You need to join the voice chat first!")
        if(serverQueue.connection.dispatcher.paused)
            return message.channel.send("The party has already paused!")
        serverQueue.connection.dispatcher.pause();
        message.channel.send("The listening party is now paused!");
    }
    function resume(serverQueue){
        if(!serverQueue.connection)
            return message.channel.send("There isn't any music playing...");
        if(!message.member.voice.channel)
            return message.channel.send("You need to join the voice chat first!")
        if(serverQueue.connection.dispatcher.resumed)
            return message.channel.send("The song is already playing..")
        serverQueue.connection.dispatcher.resume();
        message.channel.send("The listening party has resumed");
    }
    function Loop(args, serverQueue){
        if(!serverQueue.connection)
            return message.channel.send("There is no music currently playing!");
        if(!message.member.voice.channel)
            return message.channel.send("You are not in the voice channel!")

        if (args.length <= 0) 
            return message.channel.send("Please specify what loop you want. -loop `<one/all/off>`")
        
        switch(args[0].toLowerCase()){
           case 'all':
               serverQueue.loopall = !serverQueue.loopall;
               serverQueue.loopone = false;

               if(serverQueue.loopall === true)
                   message.channel.send("Now looping the queue!");
               else
                    message.channel.send("Queue looping has been turned off!");

               break;
            case 'one':
                serverQueue.loopone = !serverQueue.loopone;
                serverQueue.loopall = false;

                if(serverQueue.loopone === true)
                    message.channel.send("Now looping the song!");
                else
                    message.channel.send("Song looping has been turned off!");
                break;
            case 'off':
                    serverQueue.loopall = false;
                    serverQueue.loopone = false;

                    message.channel.send("Loop has been turned off!");
                break;
            default:
                message.channel.send("Please specify what loop you want. !loop `<one/all/off>`"); 
        }
    }
    function Queue(serverQueue){
        if(!serverQueue.connection)
            return message.channel.send("There is no music currently playing!");
        if(!message.member.voice.channel)
            return message.channel.send("You are not in the voice channel!")

        let nowPlaying = serverQueue.songs[0];
        let qMsg =  `Now playing: ${nowPlaying.title}\n--------------------------\n`

        for(var i = 1; i < serverQueue.songs.length; i++){
            qMsg += `${i}. ${serverQueue.songs[i].title}\n`
        }

        message.channel.send('```' + qMsg + 'Requested by: ' + message.author.username + '```');
    }
})

client.on('message', (receivedMessage) => {
    let prefix = '-'

    if (receivedMessage.author == client.user) {
        return
    }
    if (receivedMessage.content.startsWith(prefix)) {
        proccessCommand(receivedMessage)
    }
    if (receivedMessage.content == "<@!786038750470733855>") {
        receivedMessage.channel.send("Hello! My prefix is '-'")
    }
    if (receivedMessage.content == "fuck") {
        receivedMessage.delete
    }
})

function proccessCommand(receivedMessage) {
    let fullCommand = receivedMessage.content.substr(1)
    let splitCommand = fullCommand.split(" ")
    let primaryCommand = splitCommand[0]
    let arguments = splitCommand.slice(1)

    if (primaryCommand == "help") {
        helpCommand(arguments, receivedMessage)
    } else if (primaryCommand == "smacc") {
        smaccCommand(arguments, receivedMessage)
    } else if (primaryCommand == "repeat") {
        repeatCommand(arguments, receivedMessage)
    } else if (primaryCommand == "pat") {
        patCommand(arguments, receivedMessage)
    } else if (primaryCommand == "cock") {
        cockCommand(arguments, receivedMessage)
    } else if (primaryCommand == "suckacock") {
        suckacockCommand(arguments, receivedMessage)
    } else if (primaryCommand == "massping") {
        masspingCommand(arguments, receivedMessage)
    } else if (primaryCommand == "tail") {
        tailCommand(arguments, receivedMessage)
    } else if (primaryCommand == "off") {
        offCommand(arguments, receivedMessage)
    } else if (primaryCommand == "whois") {
        whoisCommand(arguments, receivedMessage)
    } else if (primaryCommand == "av") {
        avCommand(arguments, receivedMessage)
    } else if (primaryCommand == "hug") {
        hugCommand(arguments, receivedMessage)
    } else if (primaryCommand == "jail") {
        jailCommand(arguments, receivedMessage)
    } else if (primaryCommand == "pounce") {
        pounceCommand(arguments, receivedMessage)
    } else if (primaryCommand == "beans") {
        beansCommand(arguments, receivedMessage)
    } else if (primaryCommand == "boop") {
        boopCommand(arguments, receivedMessage)
    } else if (primaryCommand == "snuggle") {
        snuggleCommand(arguments, receivedMessage)
    } else if (primaryCommand == "poke") {
        pokeCommand(arguments, receivedMessage)
    } else if (primaryCommand == "lick") {
        lickCommand(arguments, receivedMessage)
    } else if (primaryCommand == "nom") {
        nomCommand(arguments, receivedMessage) 
    } else if (primaryCommand == "bite") {
        biteCommand(arguments, receivedMessage)
    } else if (primaryCommand = "invite") {
        inviteCommand(arguments, receivedMessage)
    }
}


function inviteCommand(arguments, receivedMessage) {
    
    if (arguments.length < 1) {
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
                name: '',
                icon_url: '',
            },
            title: 'Falcon Bot Invite Link',
            description: "Thanks for considering inviting falcon to your server!",
            url: "https://discord.com/oauth2/authorize?client_id=785603111225655316&scope=bot&permissions=8"
        }
        });
    }
    if (arguments.length > 0) {
        receivedMessage.channel.send("Too many arguments provided.")
    }
}


function avCommand(arguments, receivedMessage) {
    let args = arguments
    
    if (arguments.length < 1) {
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
              name: receivedMessage.author.username,
              icon_url: receivedMessage.author.avatarURL
            },
            title: "Avatar",
            image: {
                url: receivedMessage.author.avatarURL(),
            }
        }});   
    }
    if (arguments.length == 1) {
        let userID = receivedMessage.mentions.users.members;

        if (userID == ' ') {
            receivedMessage.reply('Invalid user ID or mention.');
            return;
        }

        receivedMessage.guild.members.fetch(userID).then(member => {
            receivedMessage.channel.send({embed: {
                color: 3447003,
                author: {
                  name: receivedMessage.author.username,
                  icon_url: receivedMessage.author.avatarURL
                },
                title: userID.user.username + "'s" + " Avatar",
                image: {
                    url: userID.user.avatarURL(),
                }
            }});   
        }).catch(() => {
            receivedMessage.channel.send('Could not find a member with the given ID or mention! (Unfortunately pinging a user does not work, either look manually or use a different bot)');
        });
    }

}



function whoisCommand(arguments, receivedMessage) {
    let args = arguments
    
    if (arguments.length < 1) {
        receivedMessage.channel.send("You did not provide a valid user")
        return
    }
    if (arguments.length == 1) {
         // Replace mentions to IDs
        // A mention is formatted like this: <@user_id> or <@!user_id>
        let userID = args.includes('<@!') ? args.replace('<@!', '').replace('>', '')
            : args.includes('<@') ? args.replace('<@', '').replace('<', '') : '';

        if (userID == ' ') {
            receivedMessage.reply('Invalid user ID or mention.');
            return;
        }

        // Check the 'Promises' part to learn about .then() and .catch()!
        receivedMessage.guild.members.fetch(userID).then(member => {
            // Got the member!
            receivedMessage.channel.send('Member found: ' + member.user.tag
            + '\nJoined: ' + member.joinedAt);
        }).catch(() => {
            // Error, member not found
            receivedMessage.channel.send('Could not find a member with the given ID or mention!');
        });
    }

}


function hugCommand(arguments, receivedMessage) {
    if (arguments.length > 1) {
        receivedMessage.channel.send("I love group hugs but I'd prefer to hug only one person at once.")
    }
    if (arguments.length < 1) {
        receivedMessage.channel.send("Are you trying to hug yourself..?")
    }
    if (arguments.length == 1) {
        receivedMessage.delete()
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
                name: '',
                icon_url: '',
            },
            description: (receivedMessage.author.toString() + " gibs the biggest hug to " + arguments),
        }
        });
    }
    if (arguments.includes("cock")) {
        receivedMessage.channel.send("Reference to the -cock command.")
    }
}


function pounceCommand(arguments, receivedMessage) { 
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many people to pounce on, you can only pounce on one person at once.")
        return 
    } 
    if (arguments.length < 1) {
        receivedMessage.channel.send("You didn't provide a person to pounce on, are you okay?")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.delete()
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
                name: '',
                icon_url: '',
            },
            description: (receivedMessage.author.toString() + " pounces on " + arguments + "!"),
        }
        });
    }
}


function smaccCommand(arguments, receivedMessage) { 
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many people to smacc, you can only smacc one person at once.")
        return 
    } 
    if (arguments.length < 1) {
        receivedMessage.channel.send("You didn't provide a person to smacc, are you okay?")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.delete()
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
                name: '',
                icon_url: '',
            },
            description: (receivedMessage.author.toString() + " smaccs " + arguments),
        }
        });
    }
}


function beansCommand(arguments, receivedMessage) { 
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many users, you can only provide one person at once.")
        return 
    } 
    if (arguments.length < 1) {
        receivedMessage.channel.send("You didn't provide a user, are you okay?")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.delete()
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
                name: '',
                icon_url: '',
            },
            description: (receivedMessage.author.toString() + " takes " + arguments + "'s paw, and TICKLES THEIR BEANS!"),
        }
        });
    }

}


function nomCommand(arguments, receivedMessage) { 
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many users to eat, you can only boop one person at once.")
        return 
    } 
    if (arguments.length < 1) {
        receivedMessage.channel.send("You didn't provide a user to eat, are you okay?")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.delete()
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
                name: '',
                icon_url: '',
            },
            description: (receivedMessage.author.toString() + " eats " + arguments + " whole! Nom nom")
        }
        });
    }

}


function biteCommand(arguments, receivedMessage) { 
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many users to bite, you can only boop one person at once.")
        return 
    } 
    if (arguments.length < 1) {
        receivedMessage.channel.send("You didn't provide a user to bite, are you okay?")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.delete()
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
                name: '',
                icon_url: '',
            },
            description: (receivedMessage.author.toString() + " bites " + arguments)
        }
        });
    }

}


function lickCommand(arguments, receivedMessage) { 
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many users to lick, you can only boop one person at once.")
        return 
    } 
    if (arguments.length < 1) {
        receivedMessage.channel.send("You didn't provide a user to lick, are you okay?")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.delete()
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
                name: '',
                icon_url: '',
            },
            description: (receivedMessage.author.toString() + " licks " + arguments)
        }
        });
    }

}


function boopCommand(arguments, receivedMessage) { 
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many users to boop, you can only boop one person at once.")
        return 
    } 
    if (arguments.length < 1) {
        receivedMessage.channel.send("You didn't provide a user to boop, are you okay?")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.delete()
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
                name: '',
                icon_url: '',
            },
            description: (receivedMessage.author.toString() + " boops " + arguments + " on the nose!")
        }
        });
    }

}


function pokeCommand(arguments, receivedMessage) { 
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many users to poke, you can only poke one person at once.")
        return 
    } 
    if (arguments.length < 1) {
        receivedMessage.channel.send("You didn't provide a user to poke, are you okay?")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.delete()
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
                name: '',
                icon_url: '',
            },
            description: (receivedMessage.author.toString() + " pokes " + arguments + " on the forehead."),
        }
        });
    }

}


function snuggleCommand(arguments, receivedMessage) { 
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many users to snuggle with, you can only provide one person at once.")
        return 
    } 
    if (arguments.length < 1) {
        receivedMessage.channel.send("You didn't provide a user to snuggle, are you okay?")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.delete()
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
                name: '',
                icon_url: '',
            },
            description: (receivedMessage.author.toString() + " snuggles with " + arguments + "!"),
        }
        });
    }

}


function patCommand(arguments, receivedMessage) { 
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many people to pat, you can only smacc one person at once.")
        return 
    } 
    if (arguments.length < 1) {
        receivedMessage.channel.send("You didn't provide a person to pat, are you okay?")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.delete()
        receivedMessage.channel.send({embed: {
            color: 3447003,
            author: {
                name: '',
                icon_url: '',
            },
            description: (receivedMessage.author.toString() + " pats " + arguments + " on the head!"),
        }
        });
    }

}


function jailCommand(arguments, receivedMessage) {
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many arguments for this command, please try again.")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.channel.send("You provided too many arguments for this command, please try again.")
        return
    }
    if (arguments.length < 1) {
        receivedMessage.channel.send("https://i.kym-cdn.com/entries/icons/facebook/000/033/758/Screen_Shot_2020-04-28_at_12.21.48_PM.jpg")
    }
}



function cockCommand(arguments, receivedMessage) {
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many arguments for this command, please try again.")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.channel.send("You provided too many arguments for this command, please try again.")
        return
    }
    if (arguments.length < 1) {
        receivedMessage.channel.send("https://i.kym-cdn.com/entries/icons/facebook/000/033/758/Screen_Shot_2020-04-28_at_12.21.48_PM.jpg")
    }
}


function suckacockCommand(arguments, receivedMessage) {
    if (arguments.length > 1) {
        receivedMessage.channel.send("You provided too many arguments for this command, please try again.")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.channel.send("You provided too many arguments for this command, please try again.")
        return
    }
    if (arguments.length < 1) {
        receivedMessage.channel.send("No you!")
    }
}


function masspingCommand(arguments, receivedMessage) { 
    if (arguments.length < 1) {
        //receivedMessage.channel.send("You didn't provide a person to ping, are you okay?")
        receivedMessage.channel.send("This command has been disabled")
    }
    if (arguments.length == 1) {
        //receivedMessage.channel.send(arguments)
        receivedMessage.channel.send("This command has been disabled")
    }

}


function tailCommand(arguments, receivedMessage) {
    if (arguments.length == 1) {
        receivedMessage.channel.send("Too many arguments provided.")
    }
    if (arguments.length > 1) {
        receivedMessage.channel.send("Too many arguments provided.")
    }
    if (arguments.length < 1) {
        receivedMessage.channel.send('<a:WaggingTail:775771029200437318>')
    }
}

function repeatCommand(arguments, receivedMessage) {
    if (arguments.length < 1) {
        receivedMessage.channel.send("You didn't provide any text for me to repeat, please try again!")
        return
    }
    if (arguments.length == 1) {
        receivedMessage.delete()
        receivedMessage.channel.send(arguments)
    } 
    if (arguments.length > 1) {
        receivedMessage.delete()
        receivedMessage.channel.send(arguments.join(' '))
    }
}

function helpCommand(arguments, receivedMessage) {
    if (arguments.length > 1) {
        receivedMessage.channel.send("Too many arguments provided. The command should be typed as '-help' only!")
    }
    receivedMessage.channel.send({embed: {
        color: 3447003,
        author: {
          name: receivedMessage.author.tag,
          icon_url: receivedMessage.author.avatarURL()
        },
        title: "Falcon Command List",
        description: "__Please note that this bot is completely ran for free and cannot be running 24/7, please don't be mad!__",
        fields: [{
            name: "**General Commands**",
            value: "`help`, `av`, `invite`"
          },
          {
            name: "**Fun Commands**",
            value: "`repeat`, `jail`"
          },
          {
              name: "**Furry Commands**",
              value: "`hug`, `pounce`, `smacc`, `tail`, `pat`, `beans`, `poke`, `snuggle`, `boop`, `nom`, `lick`, `bite`"
          },
          {
              name: "**Music Commands**",
              value: "`play`, `skip`, `stop`, `loop one`, `loop off`, `queue`, `pause`, `resume`"
          }
        ],
        timestamp: new Date(),
        footer: {
          icon_url: ('https://cdn.discordapp.com/avatars/360238392451137547/ff2b65b924b2c38e857a4d9d2d55263d.png?size=256'),
          text: "Created by ☃Snowy Flooby❄#6432!"
        }
      }
    });
}
    
function offCommand(receivedMessage, arguments) {
    console.clear
}

client.login(process.env.token)
