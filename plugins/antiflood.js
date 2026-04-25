var LGHelpTemplate = require("../GHbot.js");
const { bold, punishmentToText, getUnixTime, punishmentToFullText, chunkArray, genPunishButtons, handlePunishmentCallback } = require("../api/utils/utils.js");
const SN = require("../api/editors/setNum.js");
const ST = require("../api/editors/setTime.js");
const RM = require("../api/utils/rolesManager.js");
const { punishUser } = require("../api/utils/punishment.js");

global.LGHFlood = {};

function getDefaultFlood() {
    return {
        punishment: 0,
        delete: false,
        messages: 5,
        time: 5,
        PTime: 0,
        edit: false
    };
}

function clearOutOfRangeMessages(key, now, maxTime) {
    if (!global.LGHFlood[key]) return;

    var grouped = global.LGHFlood[key].grouped;

    Object.keys(grouped).forEach((groupId) => {
        if ((now - grouped[groupId].time) > maxTime)
            delete grouped[groupId];
    });

    Object.keys(global.LGHFlood[key].single).forEach((id) => {
        if ((now - global.LGHFlood[key].single[id]) > maxTime)
            delete global.LGHFlood[key].single[id];
    });
}

function main(args) {

    const GHbot = new LGHelpTemplate(args);
    const { TGbot, db, config } = GHbot;

    const msgMin = config.ANTIFLOOD_msgMin || 2;
    const msgMax = config.ANTIFLOOD_msgMax || 20;
    const timeMin = config.ANTIFLOOD_timeMin || 2;
    const timeMax = config.ANTIFLOOD_timeMax || 20;

    setInterval(() => {
        const now = getUnixTime();

        Object.keys(global.LGHFlood).forEach((key) => {
            clearOutOfRangeMessages(key, now, timeMax);

            if (
                Object.keys(global.LGHFlood[key].grouped).length === 0 &&
                Object.keys(global.LGHFlood[key].single).length === 0
            ) {
                delete global.LGHFlood[key];
            }
        });

    }, timeMax * 1000);

    l = global.LGHLangs;

    function ensureFlood(chat) {
        if (!chat.flood) {
            chat.flood = getDefaultFlood();
        }
        return chat.flood;
    }

    async function handleFloodMessage(msg, chat, user) {

        if (!msg.chat.isGroup) return;

        const flood = ensureFlood(msg.chat);

        if (flood.punishment === 0 && flood.delete === false) return;
        if (user.perms.flood == 1) return;

        const key = msg.chat.id + "_" + user.id;

        if (!global.LGHFlood[key]) {
            global.LGHFlood[key] = { lastPunishment: 0, grouped: {}, single: {} };
        }

        const now = msg.date;
        const grouped = global.LGHFlood[key].grouped;

        clearOutOfRangeMessages(key, now, flood.time);

        // count message
        if (msg.media_group_id) {
            if (!grouped[msg.media_group_id]) {
                grouped[msg.media_group_id] = { ids: [msg.message_id], time: now };
            } else {
                grouped[msg.media_group_id].ids.push(msg.message_id);
                grouped[msg.media_group_id].time = now;
            }
        } else {
            global.LGHFlood[key].single[msg.message_id] = now;
        }

        const messageCount =
            Object.keys(grouped).length +
            Object.keys(global.LGHFlood[key].single).length;

        const fire = messageCount > flood.messages;

        // delete
        if (fire && flood.delete) {
            let ids = [];

            Object.values(grouped).forEach(g => ids.push(...g.ids));
            ids.push(...Object.keys(global.LGHFlood[key].single));

            global.LGHFlood[key].grouped = {};
            global.LGHFlood[key].single = {};

            chunkArray(ids, 100).forEach(chunk => {
                TGbot.deleteMessages(msg.chat.id, chunk);
            });
        }

        // punish
        const last = global.LGHFlood[key].lastPunishment;
        const recently = (now - last) < flood.time;

        if (fire && !recently) {
            const PTime = flood.PTime === 0 ? -1 : flood.PTime;

            const reason = l[msg.chat.lang].ANTIFLOOD_PUNISHMENT
                .replaceAll("{number}", flood.messages)
                .replaceAll("{time}", flood.time);

            punishUser(
                GHbot,
                user.id,
                msg.chat,
                RM.userToTarget(msg.chat, user),
                flood.punishment,
                PTime,
                reason
            );
        }

        if (fire) global.LGHFlood[key].lastPunishment = now;
    }

    GHbot.onMessage(async (msg, chat, user) => {

        ensureFlood(chat);
        handleFloodMessage(msg, chat, user);

    });

    GHbot.onEditedMessage(async (msg, chat, user) => {

        const flood = ensureFlood(chat);

        if (chat.isGroup && flood.edit) {
            handleFloodMessage(msg, chat, user);
        }

    });

}

module.exports = main;
