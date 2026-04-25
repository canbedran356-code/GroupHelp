process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 0;

global.LGHVersion = "0.2.9.2";
global.directory = __dirname;

const fs = require("fs");
const TR = require("./api/tg/tagResolver.js");
const cp = require("./api/external/cryptoPrices.js");

// ENV yükle
require('dotenv').config();

// CONFIG
const config = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    OWNER_ID: process.env.OWNER_ID,
    reserveLang: process.env.RESERVE_LANG || "en",
    allowExternalApi: process.env.ALLOW_EXTERNAL_API === "true",

    // ✅ DATABASE FIX
    databasePath: __dirname + "/database"
};

// güvenlik
if (!config.BOT_TOKEN) {
    console.error("❌ BOT_TOKEN missing!");
    process.exit(1);
}

// ✅ DATABASE KLASÖRÜ YOKSA OLUŞTUR
if (!fs.existsSync(config.databasePath)) {
    fs.mkdirSync(config.databasePath);
}

console.log("Starting...");
console.log("Libre group help current version: " + global.LGHVersion);

async function main() {

    console.log("Loading languages...");
    var l = {};
    var rLang = config.reserveLang;

    l[rLang] = JSON.parse(fs.readFileSync(__dirname + "/langs/" + rLang + ".json"));
    console.log("-loaded principal language: \"" + l[rLang].LANG_NAME + "\" " + rLang);

    var langs = fs.readdirSync(__dirname + "/langs");
    langs.splice(langs.indexOf(rLang + ".json"), 1);

    var defaultLangObjects = Object.keys(l[rLang]);

    langs.forEach((langFile) => {

        var fileName = langFile.replaceAll(".json", "");
        l[fileName] = JSON.parse(fs.readFileSync(__dirname + "/langs/" + langFile));
        console.log("-loaded language: \"" + l[fileName].LANG_NAME + "\" " + fileName);

        defaultLangObjects.forEach((object) => {
            if (!l[fileName].hasOwnProperty(object)) {
                l[fileName][object] = l[rLang][object];
            }
        });

    });

    global.LGHLangs = l;

    // external API
    if (config.allowExternalApi) {
        await cp.load();
    }

    // bot yükle
    var LGHelpBot = require("./main.js");
    var { GHbot, TGbot, db } = await LGHelpBot(config);

    // pluginler
    console.log("Loading modules...");
    var directory = fs.readdirSync(__dirname + "/plugins/");

    directory.forEach((fileName) => {
        try {
            var func = require(__dirname + "/plugins/" + fileName);
            func({ GHbot: GHbot, TGbot: TGbot, db: db, config: config });
            console.log("\tloaded " + fileName);
        } catch (error) {
            console.log("Plugin crashed:", fileName);
            console.log(error);
        }
    });

    // shutdown
    var quitFunc = () => {
        db.unload();
        TR.save();
        process.exit(0);
    };

    process.on('SIGINT', quitFunc);
    process.on('SIGQUIT', quitFunc);
    process.on('SIGTERM', quitFunc);

    console.log("#LibreGroupHelp started#");
}

main();
