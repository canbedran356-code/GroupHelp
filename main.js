const LGHelpTemplate = require("./GHbot.js");
const { parseCommand } = require(__dirname + "/api/utils/utils.js");
const EventEmitter = require("node:events");
const getDatabase = require("./api/database.js");
const RM = require("./api/utils/rolesManager.js");
const TR = require("./api/tg/tagResolver.js");
const TelegramBot = require("node-telegram-bot-api");
const GHCommand = require("./api/tg/LGHCommand.js");

const {
    tag,
    getOwner,
    keysArrayToObj,
    isChatAllowed
} = require("./api/utils/utils.js");

async function main(config) {

    config.chatWhitelist = keysArrayToObj(config.chatWhitelist || {});
    config.chatBlacklist = keysArrayToObj(config.chatBlacklist || {});
    config.reserveLang = config.reserveLang || "en";

    const GroupHelpBot = new EventEmitter();
    GroupHelpBot.setMaxListeners(100);

    console.log("🤖 Starting bot...");

    const token = config.botToken || config.BOT_TOKEN;

    if (!token) {
        console.error("❌ Bot token yok!");
        process.exit(1);
    }

    const TGbot = new TelegramBot(token, { polling: true });

    try { await TGbot.deleteWebHook(); } catch (e) {}

    const bot = await TGbot.getMe();
    TGbot.me = bot;

    console.log("✅ Bot logged in as:", bot.username);

    let db;
    try {
        db = getDatabase(config);
        console.log("📁 Database ready");
    } catch (err) {
        console.log("❌ Database error:", err);
        process.exit(1);
    }

    const GHbot = new LGHelpTemplate({
        GHbot: GroupHelpBot,
        TGbot,
        db,
        config
    });

    try { TR.load(config); } catch {}

    const l = global.LGHLangs || {};

    // =========================
    // MESSAGE PARSER
    // =========================
    async function handleMessage(msg) {
        try {
            if (!msg || !msg.chat || !msg.from) return null;
            if (!isChatAllowed(config, msg.chat.id)) return null;

            TR.logMsg(msg);

            const from = msg.from;
            let chat = msg.chat;

            const isGroup = ["group", "supergroup"].includes(chat.type);
            chat.isGroup = isGroup;

            if (!db.users.exhist(from.id)) {
                db.users.add(from);
            }

            const userData = db.users.get(from.id) || {};
            const user = { ...userData, ...from };

            if (isGroup && !db.chats.get(chat.id)) {

                console.log("➕ New group:", chat.id);

                chat.lang = config.reserveLang;
                db.chats.add(chat);

                let dbChat = db.chats.get(chat.id);

                try {
                    const adminList = await TR.getAdmins(TGbot, chat.id, db);
                    dbChat = RM.reloadAdmins(dbChat, adminList);

                    db.chats.save(chat.id);

                    const creator = getOwner(adminList);
                    let text = l[dbChat.lang]?.NEW_GROUP || "Bot added.";

                    if (creator && !creator.is_anonymous) {
                        text = text.replace("{owner}", tag(".", creator.user.id));
                    } else {
                        text = text.replace("{owner}", ".");
                    }

                    await GHbot.sendMessage(user.id, chat.id, text, {
                        parse_mode: "HTML"
                    });

                } catch (e) {
                    console.log("⚠️ Admin fetch error");
                }
            }

            const dbChat = chat.isGroup ? db.chats.get(chat.id) || {} : {};
            chat = { ...dbChat, ...chat };

            msg.chat = chat;

            msg.command = parseCommand(msg.text || "");

            return { msg, chat, user };

        } catch (err) {
            console.log("❌ handleMessage error:", err);
            return null;
        }
    }

    // =========================
    // MESSAGE EVENT
    // =========================
    TGbot.on("message", async (msg) => {

        const data = await handleMessage(msg);
        if (!data) return;

        const { msg: m, chat, user } = data;

        try {
            console.log("📩 MSG:", m.text);

            GroupHelpBot.emit("message", m, chat, user);

            // ✅ COMMAND FIX
            if (m.command) {
                try {
                    GHCommand.run(m, chat, user);
                } catch (e) {
                    console.log("⚠️ Command run error:", e.message);
                }
            }

            if (chat.type === "private") {
                GroupHelpBot.emit("private", m, chat, user);
            }

        } catch (err) {
            console.log("❌ message event error:", err);
        }
    });

    // =========================
    // CALLBACK FIXED
    // =========================
    TGbot.on("callback_query", async (cb) => {
        try {
            if (!cb.message) return;

            const data = await handleMessage(cb.message);
            if (!data) return;

            const { chat, user } = data;

            TR.logCb(cb);

            // 🔥 CRITICAL FIX
            GroupHelpBot.emit("callback_query", cb, chat, user);

        } catch (err) {
            console.log("❌ callback error:", err);
        }
    });

    TGbot.on("polling_error", (err) => {
        console.log("⚠️ Polling error:", err.message);
    });

    TGbot.on("webhook_error", (err) => {
        console.log("⚠️ Webhook error:", err.message);
    });

    console.log("🚀 Bot fully started");

    return { GHbot: GroupHelpBot, TGbot, db };
}

module.exports = main;
