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
    isChatAllowed,
    getUnixTime,
    unsetWaitReply
} = require("./api/utils/utils.js");

async function main(config) {

    // ✅ CONFIG FIX
    config.chatWhitelist = config.chatWhitelist || {};
    config.chatBlacklist = config.chatBlacklist || {};
    config.reserveLang = config.reserveLang || "en";

    config.chatWhitelist = keysArrayToObj(config.chatWhitelist);
    config.chatBlacklist = keysArrayToObj(config.chatBlacklist);

    const GroupHelpBot = new EventEmitter();
    GroupHelpBot.setMaxListeners(100);

    console.log("🤖 Starting bot...");

    // ✅ TOKEN FIX (küçük/büyük farkını çözdük)
    const token = config.botToken || config.BOT_TOKEN;

    if (!token) {
        console.error("❌ Bot token yok!");
        process.exit(1);
    }

    const TGbot = new TelegramBot(token, { polling: true });

    // webhook temizle (önemli)
    try {
        await TGbot.deleteWebHook();
    } catch {}

    const bot = await TGbot.getMe();
    TGbot.me = bot;

    console.log("✅ Bot logged in as:", bot.username);

    // ✅ DATABASE
    let db;
    try {
        db = getDatabase(config);
        console.log("📁 DB path:", db.dir);
    } catch (err) {
        console.log("❌ Database error:");
        console.log(err);
        process.exit(1);
    }

    const GHbot = new LGHelpTemplate({
        GHbot: GroupHelpBot,
        TGbot,
        db,
        config
    });

    // tag resolver
    try {
        TR.load(config);
    } catch (e) {
        console.log("TR load hata ama devam ediyor");
    }

    const l = global.LGHLangs || {};

    // =========================
    // MESSAGE HANDLER (SAFE)
    // =========================
    async function handleMessage(msg) {
        try {
            if (!msg || !msg.chat || !msg.from) return null;

            if (!isChatAllowed(config, msg.chat.id)) return null;

            TR.logMsg(msg);

            const from = msg.from;
            let chat = msg.chat;

            const isGroup =
                chat.type === "supergroup" || chat.type === "group";

            chat.isGroup = isGroup;

            // user ekle
            if (!db.users.exhist(from.id)) {
                db.users.add(from);
            }

            const user = Object.assign({}, db.users.get(from.id), from);

            // grup ilk giriş
            if (isGroup && !db.chats.exhist(chat.id)) {

                console.log("➕ New group added:", chat.id);

                chat.lang = config.reserveLang;

                db.chats.add(chat);
                chat = db.chats.get(chat.id);

                try {
                    const adminList = await TR.getAdmins(TGbot, chat.id, db);
                    chat = RM.reloadAdmins(chat, adminList);
                    db.chats.update(chat);

                    const creator = getOwner(adminList);

                    let text = l[chat.lang]?.NEW_GROUP || "Bot added.";

                    if (creator && !creator.is_anonymous) {
                        text = text.replace("{owner}", tag(".", creator.user.id));
                    } else {
                        text = text.replace("{owner}", ".");
                    }

                    await GHbot.sendMessage(user.id, chat.id, text, {
                        parse_mode: "HTML"
                    });

                } catch (e) {
                    console.log("Admin çekme hatası (önemli değil)");
                }
            }

            // chat merge
            chat = Object.assign(
                {},
                chat.isGroup ? db.chats.get(chat.id) : {},
                chat
            );

            msg.chat = chat;

            // command parse
            msg.command = parseCommand(msg.text || "");

            return { msg, chat, user };

        } catch (err) {
            console.log("❌ handleMessage error:");
            console.log(err);
            return null;
        }
    }

    // =========================
    // EVENTS
    // =========================

    TGbot.on("message", async (msg) => {
        const data = await handleMessage(msg);
        if (!data) return;

        const { msg: m, chat, user } = data;

        try {
            GroupHelpBot.emit("message", m, chat, user);

            // command handler
            try {
                GHCommand.messageEvent(m, chat, user);
            } catch {}

            if (chat.type === "private") {
                GroupHelpBot.emit("private", m, chat, user);
            }

        } catch (err) {
            console.log("❌ message event error:");
            console.log(err);
        }
    });

    TGbot.on("callback_query", async (cb) => {
        try {
            if (!cb.message) return;

            const chatId = cb.message.chat.id;

            if (!isChatAllowed(config, chatId)) return;

            TR.logCb(cb);

            GroupHelpBot.emit("callback_query", cb);

        } catch (err) {
            console.log("❌ callback error:");
            console.log(err);
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
