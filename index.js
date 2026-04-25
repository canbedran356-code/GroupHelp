process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 0;

global.LGHVersion = "0.2.9.2";
global.directory = __dirname;

const fs = require("fs");
const path = require("path");
const TR = require("./api/tg/tagResolver.js");
const cp = require("./api/external/cryptoPrices.js");

require("dotenv").config();

// ✅ CONFIG (FIXED)
const config = {
    botToken: process.env.BOT_TOKEN,
    ownerId: process.env.OWNER_ID,

    reserveLang: process.env.RESERVE_LANG || "en",
    allowExternalApi: process.env.ALLOW_EXTERNAL_API === "true",

    // 🔥 BURASI DÜZELTİLDİ
    chatWhitelist: [],
    chatBlacklist: [],

    databasePath: path.join(__dirname, "database")
};

// ❗ TOKEN CHECK
if (!config.botToken) {
    console.error("❌ BOT_TOKEN missing!");
    process.exit(1);
}

// ✅ DATABASE DIR
if (!fs.existsSync(config.databasePath)) {
    fs.mkdirSync(config.databasePath, { recursive: true });
}

console.log("Starting...");
console.log("Libre group help version:", global.LGHVersion);

async function main() {

    console.log("Loading languages...");

    let l = {};
    const rLang = config.reserveLang;

    // ✅ DEFAULT LANG LOAD
    try {
        l[rLang] = JSON.parse(
            fs.readFileSync(path.join(__dirname, "langs", rLang + ".json"))
        );
    } catch (e) {
        console.error("❌ Default language yüklenemedi:", rLang);
        process.exit(1);
    }

    console.log("-loaded principal language:", l[rLang].LANG_NAME, rLang);

    let langs = fs.readdirSync(path.join(__dirname, "langs"));
    langs = langs.filter(f => f !== rLang + ".json");

    const defaultKeys = Object.keys(l[rLang]);

    langs.forEach((langFile) => {
        try {
            const fileName = langFile.replace(".json", "");

            l[fileName] = JSON.parse(
                fs.readFileSync(path.join(__dirname, "langs", langFile))
            );

            console.log("-loaded language:", l[fileName].LANG_NAME, fileName);

            defaultKeys.forEach((key) => {
                if (!l[fileName].hasOwnProperty(key)) {
                    l[fileName][key] = l[rLang][key];
                }
            });

        } catch (e) {
            console.log("⚠️ Dil yüklenemedi:", langFile);
        }
    });

    global.LGHLangs = l;

    // ✅ EXTERNAL API
    if (config.allowExternalApi) {
        try {
            await cp.load();
        } catch {
            console.log("⚠️ External API yüklenemedi");
        }
    }

    // ✅ BOT START
    const LGHelpBot = require("./main.js");

    let GHbot, TGbot, db;

    try {
        ({ GHbot, TGbot, db } = await LGHelpBot(config));
    } catch (err) {
        console.error("❌ Bot başlatılamadı:");
        console.error(err);
        process.exit(1);
    }

    // ✅ PLUGINS
    console.log("Loading modules...");
    const pluginsPath = path.join(__dirname, "plugins");

    if (fs.existsSync(pluginsPath)) {
        const files = fs.readdirSync(pluginsPath);

        files.forEach((fileName) => {
            try {
                const plugin = require(path.join(pluginsPath, fileName));

                if (typeof plugin === "function") {
                    plugin({ GHbot, TGbot, db, config });
                    console.log("✔ loaded", fileName);
                }

            } catch (error) {
                console.log("❌ Plugin crashed:", fileName);
                console.log(error.message);
            }
        });
    }

    // ✅ SHUTDOWN
    const quitFunc = () => {
        console.log("🛑 Shutting down...");
        try { db.unload(); } catch {}
        try { TR.save(); } catch {}
        process.exit(0);
    };

    process.on("SIGINT", quitFunc);
    process.on("SIGTERM", quitFunc);

    console.log("🚀 Bot fully started");
}

main();
