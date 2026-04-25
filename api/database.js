const fs = require("fs");
const TelegramBot = require('node-telegram-bot-api');
const { isValidChat, isValidUser, getUnixTime } = require(global.directory + "/api/utils/utils.js");
var RM = require("./utils/rolesManager.js");

// ✅ DEFAULT CONFIG FIX
function ensureConfig(config) {
    if (!config.saveDatabaseSeconds) {
        config.saveDatabaseSeconds = 60;
    }
    return config;
}

function newSpamObj() {
    return {
        tgLinks: { usernames: false, bots: false, exceptions: [], punishment: 1, PTime: 0 },
        links: { usernames: false, bots: false, exceptions: [], punishment: 1, PTime: 0 },
        forward: {
            channels: { punishment: 0, PTime: 0, delete: false },
            groups: { punishment: 0, PTime: 0, delete: false },
            users: { punishment: 0, PTime: 0, delete: false },
            bots: { punishment: 0, PTime: 0, delete: false },
        },
        quote: {
            channels: { punishment: 0, PTime: 0, delete: false },
            groups: { punishment: 0, PTime: 0, delete: false },
            users: { punishment: 0, PTime: 0, delete: false },
            bots: { punishment: 0, PTime: 0, delete: false },
        },
    };
}

function newCaptchaObj() {
    return {
        state: false,
        mode: "image",
        time: 3600,
        once: false,
        fails: false,
        punishment: 2,
        PTime: 0,
    };
}

function newGoodbyeObj() {
    return {
        group: false,
        clear: false,
        lastId: false,
        gMsg: {},
        private: false,
        pMsg: {},
    };
}

function newAlphabetsObj() {
    return {
        arabic: { punishment: 0, PTime: 0, delete: false },
        cyrillic: { punishment: 0, PTime: 0, delete: false },
        chinese: { punishment: 0, PTime: 0, delete: false },
        latin: { punishment: 0, PTime: 0, delete: false },
    };
}

// 🔥 SAFE DATABASE
function getDatabase(config) {

    config = ensureConfig(config);

    var dbInnerDir = global.directory;
    var dir = dbInnerDir + "/database";
    var chatsDir = dir + "/chats";
    var usersDir = dir + "/users";

    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir);
    if (!fs.existsSync(usersDir)) fs.mkdirSync(usersDir);

    global.DBCHATS = {};

    var database = {

        chatsDir,
        usersDir,

        chats: {

            add(chat) {
                if (!isValidChat(chat)) return false;

                chat.users = {};
                chat.basePerms = RM.newPerms([]);
                chat.adminPerms = RM.newPerms([]);
                chat.roles = RM.newPremadeRolesObject();
                chat.spam = newSpamObj();
                chat.captcha = newCaptchaObj();
                chat.goodbye = newGoodbyeObj();
                chat.alphabets = newAlphabetsObj();
                chat.media = {};

                fs.writeFileSync(`${chatsDir}/${chat.id}.json`, JSON.stringify(chat));
                return true;
            },

            get(chatId) {
                if (global.DBCHATS[chatId]) {
                    global.DBCHATS[chatId].lastUse = getUnixTime();
                    return global.DBCHATS[chatId];
                }

                let file = `${chatsDir}/${chatId}.json`;
                if (!fs.existsSync(file)) return null;

                try {
                    let chat = JSON.parse(fs.readFileSync(file));
                    chat.lastUse = getUnixTime();
                    global.DBCHATS[chatId] = chat;
                    return chat;
                } catch (e) {
                    console.log("chat parse error:", chatId);
                    return null;
                }
            },

            save(chatId) {
                if (!global.DBCHATS[chatId]) return false;

                let file = `${chatsDir}/${chatId}.json`;
                let data = { ...global.DBCHATS[chatId] };
                delete data.lastUse;

                fs.writeFileSync(file, JSON.stringify(data));
                return true;
            }
        },

        users: {

            add(user) {
                if (!isValidUser(user)) return false;

                user.waitingReply = false;
                user.lang = "en_en";

                fs.writeFileSync(`${usersDir}/${user.id}.json`, JSON.stringify(user));
                return true;
            },

            // 🔥 FIXED GET (CRASH YOK)
            get(userId) {
                let file = `${usersDir}/${userId}.json`;

                if (!fs.existsSync(file)) return null;

                try {
                    return JSON.parse(fs.readFileSync(file));
                } catch (e) {
                    console.log("user parse error:", userId);
                    return null;
                }
            },

            // 🔥 FIXED EXIST
            exhist(userId) {
                if (!userId) return false;
                return fs.existsSync(`${usersDir}/${userId}.json`);
            },

            update(user) {
                if (!isValidUser(user)) return false;

                let old = database.users.get(user.id) || {};
                let newUser = { ...old, ...user };

                fs.writeFileSync(`${usersDir}/${user.id}.json`, JSON.stringify(newUser));
                return true;
            }
        }
    };

    // 🔥 AUTO SAVE
    setInterval(() => {
        Object.keys(global.DBCHATS).forEach(id => {
            database.chats.save(id);
        });
    }, config.saveDatabaseSeconds * 1000);

    return database;
}

module.exports = getDatabase;
