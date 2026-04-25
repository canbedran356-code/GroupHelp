const LGHelpTemplate = require("./GHbot.js");
const {parseCommand} = require(__dirname + "/api/utils/utils.js");
const EventEmitter = require("node:events");
const getDatabase = require("./api/database.js");
const RM = require("./api/utils/rolesManager.js");
const TR = require("./api/tg/tagResolver.js");
const TelegramBot = require('node-telegram-bot-api');
const GHCommand = require("./api/tg/LGHCommand.js");
const {tag, getOwner, keysArrayToObj, isChatAllowed, getUnixTime, unsetWaitReply } = require("./api/utils/utils.js");

async function main(config) {

    // ✅ güvenlik (boşsa patlamasın)
    config.chatWhitelist = config.chatWhitelist || {};
    config.chatBlacklist = config.chatBlacklist || {};

    config.chatWhitelist = keysArrayToObj(config.chatWhitelist);
    config.chatBlacklist = keysArrayToObj(config.chatBlacklist);

    const GroupHelpBot = new EventEmitter();
    GroupHelpBot.setMaxListeners(100);

    console.log("Starting a bot...");

    // ✅ FIX: BOT TOKEN
    var TGbot = new TelegramBot(config.BOT_TOKEN, { polling: true });

    await TGbot.setWebHook("", {
        allowed_updates: JSON.stringify([
            "message",
            "edited_message",
            "edited_channel_post",
            "callback_query",
            "message_reaction",
            "message_reaction_count",
            "chat_member"
        ])
    });

    const bot = await TGbot.getMe();
    TGbot.me = bot;

    // database
    var db = getDatabase(config);
    console.log("log db path");
    console.log(db.dir);

    const GHbot = new LGHelpTemplate({ GHbot: GroupHelpBot, TGbot, db, config });

    TR.load(config);

    l = global.LGHLangs;

    async function handleMessage(msg, metadata) { try {

        if(!isChatAllowed(config, msg.chat.id)) return;

        TR.logMsg(msg);

        var from = msg.from;
        var chat = msg.chat;
        var isGroup = (chat.type == "supergroup" || chat.type == "group");
        chat.isGroup = isGroup;

        if (!db.users.exhist(from.id))
            db.users.add(from);

        var user = Object.assign({}, db.users.get(from.id), msg.from);

        if(isGroup && (config.overwriteChatDataIfReAddedToGroup || !db.chats.exhist(chat.id))) {

            console.log("Adding new group to database");

            chat.lang = config.reserveLang;

            db.chats.add(chat);
            chat = db.chats.get(chat.id);

            var adminList = await TR.getAdmins(TGbot, chat.id, db);
            chat = RM.reloadAdmins(chat, adminList);
            db.chats.update(chat);

            var creator = getOwner(adminList);
            var newGroupText = l[chat.lang].NEW_GROUP;

            newGroupText = (creator && !creator.is_anonymous) ?
                newGroupText.replace("{owner}", tag(".", creator.user.id)) :
                newGroupText.replace("{owner}", ".");

            await GHbot.sendMessage(user.id, chat.id, newGroupText, { parse_mode: "HTML" });

        }

        chat = Object.assign({}, ((chat.isGroup ? db.chats.get(chat.id) : {})), chat);
        msg.chat = chat;

        var command = parseCommand(msg.text || "");
        msg.command = command;

        return { msg, chat, user };

    } catch (err) {
        console.log("Message handle error:");
        console.log(err);
    }}

    TGbot.on("message", async (msg, metadata) => {
        try {
            var data = await handleMessage(msg, metadata);
            if (!data) return;

            var { msg, chat, user } = data;

            GroupHelpBot.emit("message", msg, chat, user);

            if (chat.type == "private")
                GroupHelpBot.emit("private", msg, chat, user);

        } catch (err) {
            console.log("Message event error:");
            console.log(err);
        }
    });

    TGbot.on("polling_error", (err) => {
        console.log("Polling error:", err.message);
    });

    TGbot.on("webhook_error", (err) => {
        console.log("Webhook error:", err.message);
    });

    return { GHbot: GroupHelpBot, TGbot, db };
}

module.exports = main;
