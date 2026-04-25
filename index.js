process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 0;

global.LGHVersion = "0.2.9.2";
global.directory = __dirname;

const fs = require("fs");
const path = require("path");
const TR = require("./api/tg/tagResolver.js");
const cp = require("./api/external/cryptoPrices.js");

// ENV yükle
require("dotenv").config();

// CONFIG (ENV + fallback)
const config = {
    botToken: process.env.BOT_TOKEN,
    ownerId: process.env.OWNER_ID,

    reserveLang: process.env.RESERVE_LANG || "en",
    allowExternalApi: process.env.ALLOW_EXTERNAL_API === "true",

    chatWhitelist: {},
    chatBlacklist: {},

    databasePath: path.join(__dirname, "database")
};

// ❗ TOKEN kontrol
if (!config.botToken) {
    console.error("❌ BOT_TOKEN missing!");
    process.exit(1);
}

// ✅ DATABASE klasörü oluştur
if (!fs.existsSync(config.databasePath)) {
    fs.mkdirSync(config.databasePath, { recursive: true });
}

console.log("Starting...");
console.log("Libre group help current version: " + global.LGHVersion);

async function main() {

    console.log("Loading languages...");
    var l = {};
    var rLang = config.reserveLang;

    // ana dil
    l[rLang] = JSON.parse(
        fs.readFileSync(path.join(__dirname, "langs", rLang + ".json"))
    );

    console.log("-loaded principal language:", l[rLang].LANG_NAME, rLang);

    var langs = fs.readdirSync(path.join(__dirname, "langs"));
    langs = langs.filter(f => f !== rLang + ".json");

    var defaultLangObjects = Object.keys(l[rLang]);

    langs.forEach((langFile) => {

        var fileName = langFile.replace(".json", "");

        l[fileName] = JSON.parse(
            fs.readFileSync(path.join(__dirname, "langs", langFile))
        );

        console.log("-loaded language:", l[fileName].LANG_NAME, fileName);

        defaultLangObjects.forEach((object) => {
            if (!l[fileName].hasOwnProperty(object)) {
                l[fileName][object] = l[rLang][object];
            }
        });
    });

    global.LGHLangs = l;

    // external API
    if (config.allowExternalApi) {
        try {
            await cp.load();
        } catch (e) {
            console.log("External API yüklenemedi (önemli değil)");
        }
    }

    // BOT başlat
    var LGHelpBot = require("./main.js");
    var { GHbot, TGbot, db } = await LGHelpBot(config);

    // pluginler
    console.log("Loading modules...");
    const pluginsPath = path.join(__dirname, "plugins");

    if (fs.existsSync(pluginsPath)) {
        var directory = fs.readdirSync(pluginsPath);

        directory.forEach((fileName) => {
            try {
                var func = require(path.join(pluginsPath, fileName));
                func({ GHbot, TGbot, db, config });
                console.log("✔ loaded", fileName);
            } catch (error) {
                console.log("❌ Plugin crashed:", fileName);
                console.log(error);
            }
        });
    }

    // shutdown
    const quitFunc = () => {
        try { db.unload(); } catch {}
        try { TR.save(); } catch {}
        process.exit(0);
    };

    process.on("SIGINT", quitFunc);
    process.on("SIGQUIT", quitFunc);
    process.on("SIGTERM", quitFunc);

    console.log("🚀 #LibreGroupHelp started#");
}

main();
