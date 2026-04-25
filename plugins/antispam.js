const LGHelpTemplate = require("../GHbot.js");
const {
    bold,
    punishmentToText,
    punishmentToFullText,
    handlePunishmentCallback,
    genPunishButtons,
    originIsSpam,
    entitiesLinks
} = require("../api/utils/utils.js");

const ST = require("../api/editors/setTime.js");
const SE = require("../api/editors/setExceptions.js");
const CBP = require("../api/editors/setChatbasedPunish.js");
const RM = require("../api/utils/rolesManager.js");
const { applyChatBasedPunish, punishUser } = require("../api/utils/punishment.js");
const { tgLinkValidator, linksValidator } = require("../api/utils/antispam.js");

function main(args) {

    const GHbot = new LGHelpTemplate(args);
    const { TGbot, db } = GHbot;
    const l = global.LGHLangs;

    function safeDelete(chatId, msgId) {
        try {
            TGbot.deleteMessage(chatId, msgId);
        } catch {}
    }

    function safeURL(link) {
        try {
            return new URL("https://" + link).hostname;
        } catch {
            return null;
        }
    }

    function handleSpamMessages(msg, chat, user) {

        // 🔴 CRITICAL SAFE GUARD
        if (
            !msg ||
            !chat ||
            !user ||
            !user.perms ||
            !chat.spam ||
            !chat.spam.tgLinks ||
            !chat.spam.links
        ) return;

        if (!msg.chat?.isGroup) return;

        const lang = chat.lang || "en";

        // ---------------- FORWARD ----------------
        if (
            !user.perms.forward &&
            msg.forward_origin
        ) {
            try {
                const isSelf =
                    msg.forward_origin?.type === "user" &&
                    msg.forward_origin?.sender_user?.id === user.id;

                if (!isSelf) {
                    const punishType = originIsSpam(msg.forward_origin, chat.spam.tgLinks.exceptions || []);
                    if (punishType) {
                        applyChatBasedPunish(
                            GHbot,
                            user.id,
                            chat,
                            RM.userToTarget(chat, user),
                            chat.spam.forward,
                            punishType,
                            l[lang]?.FORWARD_PUNISHMENT || "Forward not allowed",
                            msg.message_id
                        );
                        return;
                    }
                }
            } catch {}
        }

        // ---------------- QUOTE ----------------
        if (
            !user.perms.quote &&
            msg.external_reply
        ) {
            try {
                const isSameChat =
                    msg.external_reply?.chat?.id === chat.id;

                if (!isSameChat) {
                    const punishType = originIsSpam(msg.external_reply.origin, chat.spam.tgLinks.exceptions || []);
                    if (punishType) {
                        applyChatBasedPunish(
                            GHbot,
                            user.id,
                            chat,
                            RM.userToTarget(chat, user),
                            chat.spam.quote,
                            punishType,
                            l[lang]?.QUOTE_PUNISHMENT || "Quote not allowed",
                            msg.message_id
                        );
                        return;
                    }
                }
            } catch {}
        }

        // ---------------- TEXT ----------------
        let text = msg.text || msg.caption;
        if (!text) return;

        try {
            if (msg.entities)
                text += " " + entitiesLinks(msg.entities).join(" ");
            if (msg.caption_entities)
                text += " " + entitiesLinks(msg.caption_entities).join(" ");
        } catch {}

        // ---------------- TG LINKS ----------------
        if (user.perms.tgLink != 1 && chat.spam.tgLinks.punishment != 0) {

            const exceptions = (chat.spam.tgLinks.exceptions || [])
                .map(e => e.toLowerCase());

            const matches = [...text.matchAll(/t\.me\/(\S+)/g)];

            const bad = matches
                .map(m => tgLinkValidator(m[0]))
                .filter(x => x && !exceptions.includes(x.toLowerCase()));

            if (bad.length > 0) {

                if (chat.spam.tgLinks.delete)
                    safeDelete(chat.id, msg.message_id);

                punishUser(
                    GHbot,
                    user.id,
                    chat,
                    RM.userToTarget(chat, user),
                    chat.spam.tgLinks.punishment,
                    chat.spam.tgLinks.PTime,
                    l[lang]?.TGLINK_PUNISHMENT || "TG link not allowed"
                );
                return;
            }
        }

        // ---------------- NORMAL LINKS ----------------
        if (user.perms.link != 1 && chat.spam.links.punishment != 0) {

            const matches = [...text.matchAll(/https?:\/\/[^\s]+/g)];

            const badLinks = matches.filter(m => {
                const host = safeURL(m[0].replace("https://", "").replace("http://", ""));
                if (!host) return false;

                return !["t.me", "telegram.me"].includes(host);
            });

            if (badLinks.length > 0) {

                if (chat.spam.links.delete)
                    safeDelete(chat.id, msg.message_id);

                punishUser(
                    GHbot,
                    user.id,
                    chat,
                    RM.userToTarget(chat, user),
                    chat.spam.links.punishment,
                    chat.spam.links.PTime,
                    l[lang]?.LINK_PUNISHMENT || "Link not allowed"
                );
                return;
            }
        }
    }

    GHbot.onMessage((msg, chat, user) => {
        handleSpamMessages(msg, chat, user);
    });

    GHbot.onEditedMessageText((msg, chat, user) => {
        handleSpamMessages(msg, chat, user);
    });

}

module.exports = main;
