// Credits to: https://github.com/zhycorp/music-bot-example.git
// Versión traducida al español ;)
// Bot de música para Discord
const { Client, Util, MessageEmbed } = require("discord.js");
const YouTube = require("simple-youtube-api");
const ytdl = require("ytdl-core");
require("dotenv").config();
require("./server.js");

const bot = new Client({
    disableMentions: "all"
});

const PREFIX = process.env.PREFIX;
const youtube = new YouTube(process.env.YTAPI_KEY);
const queue = new Map();

bot.on("warn", console.warn);
bot.on("error", console.error);
bot.on("ready", () => console.log(`[READY] ${bot.user.tag} tu bot fue iniciado correctamente`));
bot.on("shardDisconnect", (event, id) => console.log(`[SHARD] Bot ${id} desconectado (${event.code}) ${event}, intentando reconectarme...`));
bot.on("shardReconnecting", (id) => console.log(`[SHARD] Shard ${id} reconectando..`));

bot.on("message", async (message) => { // eslint-disable-line
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.split(" ");
    const searchString = args.slice(1).join(" ");
    const url = args[1] ? args[1].replace(/<(.+)>/g, "$1") : "";
    const serverQueue = queue.get(message.guild.id);

    let command = message.content.toLowerCase().split(" ")[0];
    command = command.slice(PREFIX.length);

    if (command === "help" || command === "cmd") {
        const helpembed = new MessageEmbed()
            .setColor("BLUE")
            .setAuthor(bot.user.tag, bot.user.displayAvatarURL())
            .setDescription(`
__**Lista de comandos**__
> \`play\` > **\`play [titulo/url]\`**
> \`search\` > **\`search [titulo]\`**
> \`skip\`, \`stop\`,  \`pause\`, \`resume\`
> \`nowplaying\`, \`queue\`, \`volume\``)
            .setFooter("Comandos del bot");
        message.channel.send(helpembed);
    }
    if (command === "play" || command === "p") {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.channel.send("¡Lo siento pero tienes que estar en un canal de voz para reproducir música!");
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has("CONNECT")) {
            return message.channel.send("Lo siento pero necesito el permiso **`CONNECT o CONECTAR`** para poder conectarme al canal de voz!");
        }
        if (!permissions.has("SPEAK")) {
            return message.channel.send("Lo siento pero necesito el permiso **`SPEAK o HABLAR`** para reproducir música!");
        }
        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                await handleVideo(video2, message, voiceChannel, true); // eslint-disable-line no-await-in-loop
            }
            return message.channel.send(`✅  **|**  Playlist: **\`${playlist.title}\`** fue añadida a la cola`);
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 10);
                    var video = await youtube.getVideoByID(videos[0].id);
                    if (!video) return message.channel.send("🆘  **|**  No pude obtener ningún resultado de búsqueda,");
                } catch (err) {
                    console.error(err);
                    return message.channel.send("🆘  **|** No pude obtener ningún resultado de búsqueda.");
                }
            }
            return handleVideo(video, message, voiceChannel);
        }
    }
    if (command === "search" || command === "sc") {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.channel.send("!Lo siento pero tienes que estar en un canal de voz para reproducir música!");
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has("CONNECT")) {
            return message.channel.send("¡Lo siento pero necesito el permiso **`CONNECT o CONECTAR`** para conectarme al canal de voz!");
        }
        if (!permissions.has("SPEAK")) {
            return message.channel.send("¡Lo siento pero necesito el permiso **`SPEAK o HABLAR`** para reproducir música!");
        }
        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                await handleVideo(video2, message, voiceChannel, true); // eslint-disable-line no-await-in-loop
            }
            return message.channel.send(`✅  **|**  Playlist: **\`${playlist.title}\`** fue añadida a la cola`);
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 10);
                    let index = 0;
                    let embedPlay = new MessageEmbed()
                        .setColor("BLUE")
                        .setAuthor("Resultados de tú búsqueda", message.author.displayAvatarURL())
                        .setDescription(`${videos.map(video2 => `**\`${++index}\`  |**  ${video2.title}`).join("\n")}`)
                        .setFooter("Elija **uno** de los siguientes 10 resultados, este embed sera autoeliminado en 15 segundos");
                    // eslint-disable-next-line max-depth
                    message.channel.send(embedPlay).then(m => m.delete({
                        timeout: 15000
                    }))
                    try {
                        var response = await message.channel.awaitMessages(message2 => message2.content > 0 && message2.content < 11, {
                            max: 1,
                            time: 15000,
                            errors: ["time"]
                        });
                    } catch (err) {
                        console.error(err);
                        return message.channel.send("El tiempo de selección ha expirado en 15 segundos, la solicitud ha sido cancelada.");
                    }
                    const videoIndex = parseInt(response.first().content);
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
                } catch (err) {
                    console.error(err);
                    return message.channel.send("🆘  **|**  No pude obtener ningún resultado de búsqueda");
                }
            }
            response.delete();
            return handleVideo(video, message, voiceChannel);
        }

    } else if (command === "skip") {
        if (!message.member.voice.channel) return message.channel.send("Lo siento pero tienes que estar conectado en el canal de voz para saltar la canción!");
        if (!serverQueue) return message.channel.send("No hay nada reproduciéndose en este momento");
        serverQueue.connection.dispatcher.end("[runCmd] El comando **skip** fue usado");
        return message.channel.send("⏭️  **|**  Saltare esta canción para ti");

    } else if (command === "stop") {
        if (!message.member.voice.channel) return message.channel.send("Lo siento, pero necesitas estar en un canal de voz para detener la música.!");
        if (!serverQueue) return message.channel.send("No hay música reproduciéndose");
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end("[runCmd] El comando **Stop** fue usado");
        return message.channel.send("⏹️  **|** Eliminando colas y saliendome del canal de voz...");

    } else if (command === "volume" || command === "vol") {
        if (!message.member.voice.channel) return message.channel.send("¡Lo siento pero tienes que estar en un canal de voz para estabelcer el volumen!");
        if (!serverQueue) return message.channel.send("No hay nada reproduciéndose");
        if (!args[1]) return message.channel.send(`The current volume is: **\`${serverQueue.volume}%\`**`);
        if (isNaN(args[1]) || args[1] > 100) return message.channel.send("El volumen solo se puede configurar en un rango de **\`1\`** - **\`100\`**");
        serverQueue.volume = args[1];
        serverQueue.connection.dispatcher.setVolume(args[1] / 100);
        return message.channel.send(`Establecí el volumen al: **\`${args[1]}%\`**`);

    } else if (command === "nowplaying" || command === "np") {
        if (!serverQueue) return message.channel.send("No hay nada reproduciéndose");
        return message.channel.send(`🎶  **|**  Ahora reproduciéndose: **\`${serverQueue.songs[0].title}\`**`);

    } else if (command === "queue" || command === "q") {
        if (!serverQueue) return message.channel.send("No hay nada reproduciéndose");
        let embedQueue = new MessageEmbed()
            .setColor("BLUE")
            .setAuthor("Canción en la cola", message.author.displayAvatarURL())
            .setDescription(`${serverQueue.songs.map(song => `**-** ${song.title}`).join("\n")}`)
            .setFooter(`• Ahora reproduciéndose: ${serverQueue.songs[0].title}`);
        return message.channel.send(embedQueue);

    } else if (command === "pause") {
        if (serverQueue && serverQueue.playing) {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return message.channel.send("⏸  **|**  Pause la música para ti");
        }
        return message.channel.send("No hay nada reproduciéndose");

    } else if (command === "resume") {
        if (serverQueue && !serverQueue.playing) {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return message.channel.send("▶  **|**  Reanude la música por ti");
        }
        return message.channel.send("No hay nada reproduciéndose");
    } else if (command === "loop") {
        if (serverQueue) {
            serverQueue.loop = !serverQueue.loop;
            return message.channel.send(`🔁  **|**  Modo repetición está **\`${serverQueue.loop === true ? "activado" : "desactivado"}\`**`);
        };
        return message.channel.send("No hay nada reproduciéndose");
    }
});

async function handleVideo(video, message, voiceChannel, playlist = false) {
    const serverQueue = queue.get(message.guild.id);
    const song = {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    };
    if (!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 100,
            playing: true,
            loop: false
        };
        queue.set(message.guild.id, queueConstruct);
        queueConstruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(message.guild, queueConstruct.songs[0]);
        } catch (error) {
            console.error(`[ERROR] No me pude unir al canal de voz debido a: ${error}`);
            queue.delete(message.guild.id);
            return message.channel.send(`No me pude unir al canal de voz, debido a: **\`${error}\`**`);
        }
    } else {
        serverQueue.songs.push(song);
        if (playlist) return;
        else return message.channel.send(`✅  **|**  **\`${song.title}\`** fue añadido a la cola`);
    }
    return;
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.voiceChannel.leave();
        return queue.delete(guild.id);
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
        .on("finish", () => {
            const shiffed = serverQueue.songs.shift();
            if (serverQueue.loop === true) {
                serverQueue.songs.push(shiffed);
            };
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolume(serverQueue.volume / 100);

    serverQueue.textChannel.send({
        embed: {
            color: "BLUE",
            description: `🎶  **|**  Empezando a reproducir: **\`${song.title}\`**`
        }
    });
}

bot.login(process.env.BOT_TOKEN);