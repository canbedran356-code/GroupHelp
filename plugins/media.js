// 🔥 CRASH FIX
if(!chat.media) chat.media = {};

if(msg.chat.type != "private"){(()=>{

    if(!user || !user.perms || user.perms.media == 1) return;

    var mediaPunish = newPunishObj();
    var textPunish = newPunishObj();
    var totalPunish = newPunishObj();
    var punishList = [];

    mediaPunish = sumPunishMessageMedia(mediaPunish, punishList, chat.media, msg, mapping);
    textPunish = sumPunishEntitiesMedia(chat, msg, textPunish, punishList);

    var isAlbum = msg.hasOwnProperty("media_group_id");
    var toHandleAlbum = chat.media.hasOwnProperty("album") && isAlbum;

    if(isAlbum && !global.LGHMedia.hasOwnProperty(msg.media_group_id)){
        global.LGHMedia[msg.media_group_id] = getUnixTime();

        if(toHandleAlbum){
            mediaPunish = sumPunishObj(mediaPunish, chat.media.album);
            punishList.push("album");
        }

    } else if(isAlbum && global.LGHMedia.hasOwnProperty(msg.media_group_id)){

        totalPunish.delete = mediaPunish.delete;
        if(toHandleAlbum) totalPunish.delete = totalPunish.delete || chat.media.album;

        mediaPunish = newPunishObj();
    }

    totalPunish = sumPunishObj(mediaPunish, textPunish);

    // emoji fix
    if(chat.media.hasOwnProperty("emoji_video") && msg.text && msg.text.length <= 4 && emojiTable[msg.text] && !isAlbum){
        totalPunish = sumPunishObj(totalPunish, chat.media.emoji_video);
        punishList.push("emoji_video");
    }

    // sticker FIX
    if(chat.media.hasOwnProperty("sticker") && msg.hasOwnProperty("sticker") && !msg.sticker.is_video && !msg.sticker.is_animated){
        totalPunish = sumPunishObj(totalPunish, chat.media.sticker);
        punishList.push("sticker");
    }

    // 🔥 BURASI KRİTİK FIX
    if(chat.media.hasOwnProperty("sticker_video") && msg.hasOwnProperty("sticker") && (msg.sticker.is_video || msg.sticker.is_animated)){
        totalPunish = sumPunishObj(totalPunish, chat.media.sticker_video);
        punishList.push("sticker_video");
    }

    var text = msg.text || msg.caption;

    if(chat.media.hasOwnProperty("capital") && isLatin(text) && text == text.toUpperCase()){
        totalPunish = sumPunishObj(totalPunish, chat.media.capital);
        punishList.push("capital");
    }

    if(chat.media.hasOwnProperty("scheduled") && msg.is_from_offline){
        totalPunish = sumPunishObj(totalPunish, chat.media.scheduled);
        punishList.push("scheduled");
    }

    // 🔥 PUNISH SAFE
    if(totalPunish.punishment != 0){

        punishList = punishList.map(type => l[chat.lang]["MEDIA:"+type] || type);

        var types = punishList.join("+");
        var reason = l[chat.lang].UNALLOWED_MEDIA_PUNISHMENT.replace("{types}", types);

        punishUser(GHbot, user.id, msg.chat, RM.userToTarget(msg.chat, user), totalPunish.punishment, totalPunish.PTime, reason);
    }

    // 🔥 DELETE SAFE
    if(totalPunish.delete){
        try {
            GHbot.TGbot.deleteMessages(chat.id, [msg.message_id]);
        } catch(e){}
    }

})()}
