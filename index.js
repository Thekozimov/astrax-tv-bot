const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('AstraxTV Bot is active!');
});

app.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
});

const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const token = process.env.BOT_TOKEN;

// Majburiy kanallar ro'yxati (Boshlang'ich qiymat .env yoki default)
let REQUIRED_CHANNELS = process.env.REQUIRED_CHANNEL 
    ? [process.env.REQUIRED_CHANNEL] 
    : ['@astrax_tv'];

// Adminlar ro'yxati
let ADMIN_IDS = process.env.ADMIN_IDS 
    ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) 
    : [];

const bot = new TelegramBot(token, { polling: true });

// Kontentlar bazasi (Xotirada)
let contentData = [];
const userState = {};

const bannerPath = path.join(__dirname, 'assets', 'astraxtv.jpg');

// Asosiy Menyu (Reply Keyboard)
function getReplyKeyboard(userId) {
    const keyboard = [
        [{ text: "🔭 qidirish" }, { text: "🌌 Barcha animelar" }],
        [{ text: "🪐 Janrlar" }, { text: "👑 VIP" }],
        [{ text: "🏆 TOP" }, { text: "🧑‍🚀 Profil" }],
        [{ text: "✨ Bot haqida" }]
    ];
    
    if (isAdmin(userId)) {
        keyboard.push([{ text: "🛠 Admin Panel" }]);
    }

    return {
        reply_markup: {
            keyboard: keyboard,
            resize_keyboard: true
        }
    };
}

// Inline Menyular
const inlineCategoriesMenu = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "🆔 Kod orqali qidiruv", callback_data: "btn_code_search" }],
            [
                { text: "🎬 Anime", callback_data: "cat_Anime" },
                { text: "🎥 Film", callback_data: "cat_Film" }
            ],
            [
                { text: "🧸 Multfilm", callback_data: "cat_Multfilm" },
                { text: "🎭 Drama", callback_data: "cat_Drama" }
            ],
            [
                { text: "📚 Qo'llanma", callback_data: "btn_guide" },
                { text: "📢 Reklama", callback_data: "btn_ad" }
            ],
            [{ text: "📁 Barcha Ro'yxat", callback_data: "btn_list" }]
        ]
    },
    parse_mode: 'HTML'
};

// Admin Menyusi (Kanallarni boshqarish tugmasi qo'shildi)
const adminMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "➕ Yangi Kontent Qo'shish", callback_data: "admin_add_content" }],
            [{ text: "✏️ Kontentni Tahrirlash / O'chirish", callback_data: "admin_manage_content" }],
            [{ text: "📢 Majburiy Kanallarni Boshqarish", callback_data: "admin_manage_channels" }],
            [{ text: "👥 Adminlar Ro'yxati", callback_data: "admin_list_admins" }, { text: "➕ Yangi Admin Qo'shish", callback_data: "admin_add_new_admin" }],
            [{ text: "📊 Statistika", callback_data: "admin_stats" }]
        ]
    },
    parse_mode: 'HTML'
};

const mainCaption = `👋 <b>AstraxTV olamiga xush kelibsiz!</b>\n\n🤖 Botimiz orqali sevimli anime, film, multfilm va dramalaringizni o'zbek tilida, eng yuqori sifatda tomosha qilishingiz mumkin. Quyidagi bo'limlardan birini tanlang:`;

// Adminlikni tekshirish
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId.toString());
}

// Majburiy obunani tekshirish (Barcha kanallar uchun)
async function checkSubscription(chatId, userId) {
    if (isAdmin(userId)) return true; // Admin bo'lsa tekshirmaydi
    if (REQUIRED_CHANNELS.length === 0) return true;

    for (const channel of REQUIRED_CHANNELS) {
        try {
            const member = await bot.getChatMember(channel, userId);
            const isSub = ['creator', 'administrator', 'member'].includes(member.status);
            if (!isSub) return false;
        } catch (error) {
            console.error(`${channel} bo'yicha obuna tekshirishda xato:`, error.message);
            return false;
        }
    }
    return true;
}

async function sendSubWarning(chatId) {
    const channelButtons = REQUIRED_CHANNELS.map((ch, index) => [
        { text: `📢 ${index + 1}-Kanalga obuna bo'lish`, url: `https://t.me/${ch.replace('@', '')}` }
    ]);

    channelButtons.push([{ text: "✅ Obunani tekshirish", callback_data: "check_sub" }]);

    const keyboard = {
        reply_markup: {
            inline_keyboard: channelButtons
        },
        parse_mode: 'HTML'
    };

    let channelsListText = REQUIRED_CHANNELS.map(ch => `• <b>${ch}</b>`).join('\n');

    await bot.sendMessage(
        chatId, 
        `⚠️ <b>AstraxTV botidan foydalanish uchun quyidagi barcha kanallarimizga obuna bo'lishingiz kerak:</b>\n\n${channelsListText}`, 
        keyboard
    );
}

// /start buyrug'i
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    userState[chatId] = null;

    const isSubscribed = await checkSubscription(chatId, userId);
    if (!isSubscribed) return await sendSubWarning(chatId);

    await bot.sendMessage(chatId, "Bosh menyu yuklandi:", getReplyKeyboard(userId));

    try {
        if (fs.existsSync(bannerPath)) {
            await bot.sendPhoto(chatId, bannerPath, { caption: mainCaption, ...inlineCategoriesMenu });
        } else {
            await bot.sendMessage(chatId, mainCaption, inlineCategoriesMenu);
        }
    } catch (e) {
        await bot.sendMessage(chatId, mainCaption, inlineCategoriesMenu);
    }
});

// /admin buyrug'i
bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!isAdmin(userId)) {
        return await bot.sendMessage(chatId, "❌ Siz bot admini emassiz.");
    }

    userState[chatId] = null;
    await bot.sendMessage(chatId, "🛠 <b>AstraxTV Admin Paneliga xush kelibsiz!</b>\n\nBoshqaruv tugmalaridan birini tanlang:", adminMenuKeyboard);
});

// FILE ID OLISH
bot.on('video', async (msg) => {
    if (!isAdmin(msg.from.id)) return;
    await bot.sendMessage(msg.chat.id, `🎥 <b>VIDEO FILE ID:</b>\n<code>${msg.video.file_id}</code>`, { parse_mode: 'HTML' });
});

bot.on('document', async (msg) => {
    if (!isAdmin(msg.from.id)) return;
    if (msg.document.mime_type && msg.document.mime_type.startsWith('video/')) {
        await bot.sendMessage(msg.chat.id, `📁 <b>DOCUMENT FILE ID:</b>\n<code>${msg.document.file_id}</code>`, { parse_mode: 'HTML' });
    }
});

bot.on('photo', async (msg) => {
    if (!isAdmin(msg.from.id)) return;
    const photo = msg.photo[msg.photo.length - 1];
    await bot.sendMessage(msg.chat.id, `🖼 <b>POSTER FILE ID:</b>\n<code>${photo.file_id}</code>`, { parse_mode: 'HTML' });
});

// Post va Prevyu chiqarish
async function sendContentPost(chatId, item) {
    let captionText = `🎬 <b>Nomi:</b> ${item.title}\n🆔 <b>Kodi:</b> <code>${item.code}</code>\n📌 <b>Turi:</b> ${item.type}`;
    if (item.description) {
        captionText += `\n\n💬 ${item.description}`;
    }
    captionText += `\n\n💬 @Astrax_tv uchun maxsus`;

    const episodeButtons = [];
    if (item.episodes && item.episodes.length > 0) {
        for (let i = 0; i < item.episodes.length; i += 2) {
            const row = [
                { text: `▶️ ${i + 1}-qism`, callback_data: `get_ep_${item.id}_${i}` }
            ];
            if (item.episodes[i + 1]) {
                row.push({ text: `▶️ ${i + 2}-qism`, callback_data: `get_ep_${item.id}_${i + 1}` });
            }
            episodeButtons.push(row);
        }
    }

    const options = {
        caption: captionText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: episodeButtons }
    };

    if (item.posterFileId) {
        try {
            await bot.sendPhoto(chatId, item.posterFileId, options);
        } catch (e) {
            await bot.sendMessage(chatId, captionText, options);
        }
    } else {
        await bot.sendMessage(chatId, captionText, options);
    }
}

// CALLBACK QUERY
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const messageId = query.message.message_id;
    const data = query.data;

    try { await bot.answerCallbackQuery(query.id); } catch (e) {}

    // Obuna tekshiruvi tugmasi
    if (data === 'check_sub') {
        const isSubscribed = await checkSubscription(chatId, userId);
        if (isSubscribed) {
            try { await bot.deleteMessage(chatId, messageId); } catch (e) {}
            await bot.sendMessage(chatId, "✅ Obuna tasdiqlandi!", getReplyKeyboard(userId));
            if (fs.existsSync(bannerPath)) {
                await bot.sendPhoto(chatId, bannerPath, { caption: mainCaption, ...inlineCategoriesMenu });
            } else {
                await bot.sendMessage(chatId, mainCaption, inlineCategoriesMenu);
            }
        } else {
            await bot.sendMessage(chatId, "❌ Siz hali barcha kanallarga obuna bo'lmadingiz!");
        }
        return;
    }

    if (data.startsWith('get_ep_')) {
        const [_, __, contentId, epIndex] = data.split('_');
        const item = contentData.find(c => c.id === contentId);
        
        if (item && item.episodes && item.episodes[epIndex]) {
            const videoFileId = item.episodes[epIndex];
            await bot.sendMessage(chatId, `⏳ ${parseInt(epIndex) + 1}-qism yuklanmoqda...`);
            try {
                await bot.sendVideo(chatId, videoFileId, {
                    caption: `🎬 <b>${item.title}</b> (${parseInt(epIndex) + 1}-qism)\n🆔 <b>Kodi:</b> <code>${item.code}</code>\n\n💬 @Astrax_tv uchun maxsus`,
                    parse_mode: 'HTML'
                });
            } catch (e) {
                await bot.sendMessage(chatId, "❌ Videoni yuborishda xatolik yuz berdi.");
            }
        }
        return;
    }

    // --- ADMIN TUGMALARI ---
    if (isAdmin(userId)) {
        if (data === 'admin_add_content') {
            userState[chatId] = { step: 'WAITING_CONTENT_DATA' };
            return await bot.sendMessage(chatId, 
                "📝 <b>Yangi Kontent Qo'shish</b>\n\nFormat:\n" +
                "<code>Nomi | Kodi | Turi | Poster_File_ID | Video_File_IDs | Tavsif</code>", 
                { parse_mode: 'HTML' }
            );
        }

        if (data === 'admin_manage_content') {
            if (contentData.length === 0) {
                return await bot.sendMessage(chatId, "📁 Bazada kontentlar mavjud emas.");
            }
            let text = "⚙️ <b>Tahrirlash yoki o'chirish uchun kontentni tanlang:</b>\n\n";
            const buttons = contentData.map(item => [
                { text: `✏️ ${item.title} (${item.code})`, callback_data: `admin_edit_${item.id}` },
                { text: `❌ O'chirish`, callback_data: `admin_del_${item.id}` }
            ]);
            return await bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: buttons }, parse_mode: 'HTML' });
        }

        if (data.startsWith('admin_del_')) {
            const id = data.replace('admin_del_', '');
            contentData = contentData.filter(c => c.id !== id);
            return await bot.sendMessage(chatId, "✅ Kontent bazadan o'chirib tashlandi!");
        }

        // --- MAJBURIY KANALLARNI BOSHQARISH ---
        if (data === 'admin_manage_channels') {
            let channelText = "📢 <b>Hozirgi Majburiy Kanallar:</b>\n\n";
            if (REQUIRED_CHANNELS.length === 0) {
                channelText += "<i>Hozircha majburiy kanallar yo'q.</i>\n";
            } else {
                REQUIRED_CHANNELS.forEach((ch, idx) => {
                    channelText += `${idx + 1}. <b>${ch}</b>\n`;
                });
            }

            const buttons = [
                [{ text: "➕ Yangi Kanal Qo'shish", callback_data: "admin_add_channel" }]
            ];

            REQUIRED_CHANNELS.forEach(ch => {
                buttons.push([{ text: `❌ ${ch} ni o'chirish`, callback_data: `admin_del_channel_${ch}` }]);
            });

            return await bot.sendMessage(chatId, channelText, {
                reply_markup: { inline_keyboard: buttons },
                parse_mode: 'HTML'
            });
        }

        if (data === 'admin_add_channel') {
            userState[chatId] = { step: 'WAITING_NEW_CHANNEL' };
            return await bot.sendMessage(chatId, "📢 Yangi kanal username'ini <b>@username</b> formatida yuboring:\n\n<i>Eslatma: Bot o'sha kanalda admin bo'lishi shart!</i>", { parse_mode: 'HTML' });
        }

        if (data.startsWith('admin_del_channel_')) {
            const chName = data.replace('admin_del_channel_', '');
            REQUIRED_CHANNELS = REQUIRED_CHANNELS.filter(c => c !== chName);
            return await bot.sendMessage(chatId, `✅ <b>${chName}</b> majburiy kanallar ro'yxatidan olib tashlandi!`, { parse_mode: 'HTML' });
        }

        if (data === 'admin_list_admins') {
            let text = "👥 <b>Adminlar ro'yxati:</b>\n\n";
            ADMIN_IDS.forEach((id, index) => {
                text += `${index + 1}. ID: <code>${id}</code>\n`;
            });
            return await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        }

        if (data === 'admin_add_new_admin') {
            userState[chatId] = { step: 'WAITING_NEW_ADMIN_ID' };
            return await bot.sendMessage(chatId, "👤 Yangi adminning Telegram <b>ID raqamini</b> yuboring:", { parse_mode: 'HTML' });
        }

        if (data === 'admin_stats') {
            return await bot.sendMessage(chatId, `📊 <b>AstraxTV Bot Statistikasi:</b>\n\n🎬 Bazadagi kontentlar: <b>${contentData.length} ta</b>\n📢 Majburiy kanallar: <b>${REQUIRED_CHANNELS.length} ta</b>\n👥 Adminlar soni: <b>${ADMIN_IDS.length} ta</b>`, { parse_mode: 'HTML' });
        }
    }

    // Kategoriya tugmalari
    if (data.startsWith('cat_')) {
        const category = data.replace('cat_', '');
        const filtered = contentData.filter(c => c.type.toLowerCase() === category.toLowerCase());

        if (filtered.length === 0) {
            await bot.sendMessage(chatId, `📁 <b>${category}</b> bo'limida hozircha kontentlar yo'q.`);
        } else {
            await bot.sendMessage(chatId, `📁 <b>${category} bo'limidagi barcha kontentlar:</b>`);
            for (let item of filtered) {
                await sendContentPost(chatId, item);
            }
        }
        return;
    }

    if (data === 'btn_code_search') {
        userState[chatId] = 'SEARCHING';
        await bot.sendMessage(chatId, "🎬 Qidirayotgan kontentingiz nomi yoki ID kodini kiriting:");
    } else if (data === 'btn_guide') {
        await bot.sendMessage(chatId, "📚 <b>Qo'llanma:</b>\n\nBotdan foydalanish uchun kodingizni kiriting yoki menyudagi bo'limlardan birini tanlang.");
    } else if (data === 'btn_ad') {
        await bot.sendMessage(chatId, "📢 Reklama uchun: @thekzmv");
    } else if (data === 'btn_list') {
        if (contentData.length === 0) {
            await bot.sendMessage(chatId, "📁 Hozircha AstraxTV bazasida kontentlar yo'q.");
        } else {
            let listText = "📁 <b>Mavjud Kontentlar (AstraxTV):</b>\n\n";
            contentData.forEach((item, idx) => {
                listText += `${idx + 1}. [${item.type}] <b>${item.title}</b> — Kodi: <code>${item.code}</code>\n`;
            });
            await bot.sendMessage(chatId, listText, { parse_mode: 'HTML' });
        }
    }
});

// XABARLAR
bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();

    // --- ADMIN BUYRUQLARI ---
    if (isAdmin(userId) && userState[chatId]) {
        // Yangi Kanal Qo'shish
        if (userState[chatId].step === 'WAITING_NEW_CHANNEL') {
            let chName = text.trim();
            if (!chName.startsWith('@')) chName = '@' + chName;

            if (!REQUIRED_CHANNELS.includes(chName)) {
                REQUIRED_CHANNELS.push(chName);
                userState[chatId] = null;
                return await bot.sendMessage(chatId, `✅ <b>${chName}</b> majburiy kanallar ro'yxatiga qo'shildi!\n\n<i>Eslatib o'tamiz, bot o'sha kanalda admin bo'lishi shart.</i>`, { parse_mode: 'HTML' });
            } else {
                userState[chatId] = null;
                return await bot.sendMessage(chatId, "⚠️ Ushbu kanal allaqachon ro'yxatda bor.");
            }
        }

        if (userState[chatId].step === 'WAITING_NEW_ADMIN_ID') {
            const newAdminId = text.trim();
            if (!ADMIN_IDS.includes(newAdminId)) {
                ADMIN_IDS.push(newAdminId);
                userState[chatId] = null;
                return await bot.sendMessage(chatId, `✅ <code>${newAdminId}</code> ID'li foydalanuvchi admin qilindi!`, { parse_mode: 'HTML' });
            } else {
                userState[chatId] = null;
                return await bot.sendMessage(chatId, "⚠️ Ushbu foydalanuvchi allaqachon admin.");
            }
        }

        if (userState[chatId].step === 'WAITING_CONTENT_DATA') {
            const parts = text.split('|').map(p => p.trim());
            if (parts.length >= 4) {
                const [title, code, type, posterFileId, videoIdsStr, description] = parts;
                const episodes = videoIdsStr ? videoIdsStr.split(',').map(v => v.trim()) : [];

                contentData.push({
                    id: Date.now().toString(),
                    title,
                    code,
                    type: type || 'Anime',
                    posterFileId: posterFileId || '',
                    episodes: episodes,
                    description: description || ''
                });

                userState[chatId] = null;
                return await bot.sendMessage(chatId, `✅ <b>${title}</b> (${type}) muvaffaqiyatli qo'shildi!\nKodi: <code>${code}</code>`, { parse_mode: 'HTML' });
            } else {
                return await bot.sendMessage(chatId, "❌ Noto'g'ri format! Format:\n<code>Nomi | Kodi | Turi | Poster_File_ID | Video_File_IDs | Tavsif</code>", { parse_mode: 'HTML' });
            }
        }
    }

    // Obuna tekshirish
    const isSubscribed = await checkSubscription(chatId, userId);
    if (!isSubscribed) return await sendSubWarning(chatId);

    // Reply Keyboard buyruqlari
    if (text === "🔭 qidirish") {
        userState[chatId] = 'SEARCHING';
        return await bot.sendMessage(chatId, "🎬 Qidirayotgan kontentingiz nomi yoki ID kodini kiriting:");
    }
    if (text === "🌌 Barcha animelar") {
        const animelar = contentData.filter(c => c.type.toLowerCase() === 'anime');
        if (animelar.length === 0) return await bot.sendMessage(chatId, "📁 Hozircha bazada animelar yo'q.");
        for (let item of animelar) {
            await sendContentPost(chatId, item);
        }
        return;
    }
    if (text === "🪐 Janrlar") {
        return await bot.sendMessage(chatId, "🪐 <b>Janrlar va Bo'limlar:</b>", inlineCategoriesMenu);
    }
    if (text === "👑 VIP") {
        return await bot.sendMessage(chatId, "👑 <b>VIP status:</b> Reklamasiz va tezkor yuklab olish imkoniyati.");
    }
    if (text === "🏆 TOP") {
        return await bot.sendMessage(chatId, "🏆 <b>Eng ko'p ko'rilgan haftalik TOP kontentlar:</b>\n1. Naruto\n2. Jujutsu Kaisen");
    }
    if (text === "🧑‍🚀 Profil") {
        return await bot.sendMessage(chatId, `🧑‍🚀 <b>Sizning profilingiz:</b>\n\nID: <code>${userId}</code>\nIsm: ${msg.from.first_name}`, { parse_mode: 'HTML' });
    }
    if (text === "✨ Bot haqida") {
        return await bot.sendMessage(chatId, "✨ <b>AstraxTV Bot</b> — O'zbek tilidagi sifatli anime va filmlar platformasi.");
    }
    if (text === "🛠 Admin Panel" && isAdmin(userId)) {
        return await bot.sendMessage(chatId, "🛠 <b>Admin Panel:</b>", adminMenuKeyboard);
    }

    // Qidiruv
    const query = text.toLowerCase();
    const results = contentData.filter(item => 
        item.code.toLowerCase() === query || item.title.toLowerCase().includes(query)
    );

    if (results.length > 0) {
        for (let item of results) {
            await sendContentPost(chatId, item);
        }
    } else {
        await bot.sendMessage(chatId, "🔍 Kechirasiz, AstraxTV bazasidan ushbu kod yoki nom bo'yicha hech narsa topilmadi.");
    }
});

console.log("🚀 AstraxTV Telegram Boti muvaffaqiyatli ishga tushdi!");