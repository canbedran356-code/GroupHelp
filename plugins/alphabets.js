var LGHelpTemplate = require("../GHbot.js");
const ABP = require("../api/editors/setAlphabetPunish.js");
const { punishUser } = require("../api/utils/punishment.js");
const { isString } = require("../api/utils/utils.js");
const RM = require("../api/utils/rolesManager.js");

const l = global.LGHLangs;

// REGEX
const arabicPattern = /[\u0600-\u06FF]/;
const cyrillicPattern = /[\u0400-\u04FF]/;
const HAN_REGEX = /[\u4E00-\u9FFF]/;
const LATIN_REGEX = /[a-zA-Z]/;

// SAFE CHECKS
const isArabic = (t) => isString(t) && arabicPattern.test(t);
const isCyrillic = (t) => isString(t) && cyrillicPattern.test(t);
const isChinese = (t) => isString(t) && HAN_REGEX.test(t);
const isLatin = (t) => isString(t) && LATIN_REGEX.test(t);

function main(args) {

    const GHbot = new LGHelpTemplate(args);
    const { TGbot, db } = GHbot;

    GHbot.onMessage(async (msg, chat, user) => {

        // 🔴 SAFE GUARD (EN KRİTİK)
        if (
            !msg ||
            !chat ||
            !user ||
            !user.perms ||
            !chat.alphabets
        ) return;

        // sadece group
        if (msg.chat.type === "private") return;

        // yetkili skip
        if (user.perms.alphabets === 1) return;

        const text = msg.text || msg.caption;
        if (!text) return;

        const lang = chat.lang || "en";

        const alphabets = chat.alphabets;

        // DETECT
        const arabic = alphabets.arabic && (alphabets.arabic.punishment != 0 || alphabets.arabic.delete) && isArabic(text);
        const cyrillic = alphabets.cyrillic && (alphabets.cyrillic.punishment != 0 || alphabets.cyrillic.delete) && isCyrillic(text);
        const chinese = alphabets.chinese && (alphabets.chinese.punishment != 0 || alphabets.chinese.delete) && isChinese(text);
        const latin = alphabets.latin && (alphabets.latin.punishment != 0 || alphabets.latin.delete) && isLatin(text);

        if (!(arabic || cyrillic || chinese || latin)) return;

        let punishment = 0;
        let PTime = 0;
        let deletion = false;

        if (arabic && alphabets.arabic) {
            punishment = Math.max(punishment, alphabets.arabic.punishment || 0);
            PTime = Math.max(PTime, alphabets.arabic.PTime || 0);
            deletion = deletion || alphabets.arabic.delete;
        }

        if (cyrillic && alphabets.cyrillic) {
            punishment = Math.max(punishment, alphabets.cyrillic.punishment || 0);
            PTime = Math.max(PTime, alphabets.cyrillic.PTime || 0);
            deletion = deletion || alphabets.cyrillic.delete;
        }

        if (chinese && alphabets.chinese) {
            punishment = Math.max(punishment, alphabets.chinese.punishment || 0);
            PTime = Math.max(PTime, alphabets.chinese.PTime || 0);
            deletion = deletion || alphabets.chinese.delete;
        }

        if (latin && alphabets.latin) {
            punishment = Math.max(punishment, alphabets.latin.punishment || 0);
            PTime = Math.max(PTime, alphabets.latin.PTime || 0);
            deletion = deletion || alphabets.latin.delete;
        }

        // TYPE TEXT
        let types = [];
        if (arabic) types.push(l[lang]?.ARABIC || "Arabic");
        if (cyrillic) types.push(l[lang]?.CYRILLIC || "Cyrillic");
        if (chinese) types.push(l[lang]?.CHINESE || "Chinese");
        if (latin) types.push(l[lang]?.LATIN || "Latin");

        types = types.join("+");

        let reason = l[lang]?.UNALLOWED_ALPHABET_PUNISHMENT || "Alphabet not allowed";
        reason = reason.replace("{types}", types);

        // 🔥 PUNISH
        if (punishment !== 0) {
            try {
                punishUser(GHbot, user.id, chat, RM.userToTarget(chat, user), punishment, PTime, reason);
            } catch (e) {
                console.log("Punish error:", e.message);
            }
        }

        // 🔥 DELETE
        if (deletion) {
            try {
                await TGbot.deleteMessage(chat.id, msg.message_id);
            } catch {}
        }

        // ---------------- SETTINGS PART ----------------

        if (!msg.waitingReply || !msg.waitingReply.startsWith("S_ALPHABETS")) return;
        if (msg.chat.isGroup && chat.id != msg.chat.id) return;
        if (!(user.perms && user.perms.settings)) return;

        if (msg.waitingReply.startsWith("S_ALPHABETS#ABP")) {
            const newAbp = ABP.messageEvent(GHbot, chat.alphabets, msg, chat, user, "S_ALPHABETS");
            if (newAbp) {
                chat.alphabets = newAbp;
                db.chats.update(chat);
            }
        }

    });

    GHbot.onCallback(async (cb, chat, user) => {

        if (!cb || !chat || !user) return;

        const msg = cb.message;
        const lang = user.lang || "en";

        if (!chat.isGroup) return;
        if (!cb.data || !cb.data.startsWith("S_ALPHABETS")) return;
        if (!(user.perms && user.perms.settings)) return;
        if (cb.chat.isGroup && chat.id != cb.chat.id) return;

        if (cb.data.startsWith("S_ALPHABETS#ABP")) {

            const returnButtons = [[
                { text: l[lang]?.BACK_BUTTON || "Back", callback_data: "SETTINGS_HERE:" + chat.id }
            ]];

            const title = (l[lang]?.ALPHABETS_DESCRIPTION || "") + "\n";

            const newAbp = ABP.callbackEvent(
                GHbot,
                db,
                chat.alphabets,
                cb,
                chat,
                user,
                "S_ALPHABETS",
                returnButtons,
                title
            );

            if (newAbp) {
                chat.alphabets = newAbp;
                db.chats.update(chat);
            }
        }

    });

}

module.exports = main;
