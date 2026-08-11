const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const token = process.env.BOT_TOKEN;
const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL || '@astrax_tv';

// Adminlar ro'yxatini yuklash
let ADMIN_IDS = process.env.ADMIN_IDS 
    ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) 
    : [];

const bot = new TelegramBot(token, { polling: true });

let animeData = [];
const userState = {}; // Foydalanuvchi va Admin holatlarini saqlash

const bannerPath = path.join(__dirname, 'assets', 'astraxtv.jpg');

// Asosiy foydalanuvchi menyusi
const mainMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "🆔 Kod orqali qidiruv", callback_data: "btn_code_search" }],
            [{ text: "🎬 Anime", callback_data: "btn_anime" }, { text: "📸 Rasm orqali qidiruv", callback_data: "btn_img_search" }],
            [{ text: "📚 Qo'llanma", callback_data: "btn_guide" }, { text: "📢 Reklama", callback_data: "btn_ad" }],
            [{ text: "📁 Ro'yxat", callback_data: "btn_list" }]
        ]
    },
    parse_mode: 'HTML'
};

// Admin Menyusi
const adminMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "➕ Yangi Anime Qo'shish", callback_data: "admin_add_anime" }],
            [{ text: "👥 Adminlar Ro'yxati", callback_data: "admin_list_admins" }, { text: "➕ Yangi Admin Qo'shish", callback_data: "admin_add_new_admin" }],
            [{ text: "📊 Statistika", callback_data: "admin_stats" }, { text: "⬅️ Asosiy Menyu", callback_data: "btn_main_menu" }]
        ]
    },
    parse_mode: 'HTML'
};

const mainCaption = `👋 <b>AstraxTV olamiga xush kelibsiz!</b>\n\n🤖 Botimiz orqali sevimli animelaringizni o'zbek tilida, eng yuqori sifatda tomosha qilishingiz mumkin. Quyidagi tugmalardan birini tanlang:`;

// Adminlikni tekshirish funksiyasi
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId.toString());
}

// Majburiy obunani tekshirish
async function checkSubscription(chatId, userId) {
    try {
        const member = await bot.getChatMember(REQUIRED_CHANNEL, userId);
        return ['creator', 'administrator', 'member'].includes(member.status);
    } catch (error) {
        return true; 
    }
}

async function sendSubWarning(chatId) {
    const channelUrl = `https://t.me/${REQUIRED_CHANNEL.replace('@', '')}`;
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📢 Kanalga obuna bo'lish", url: channelUrl }],
                [{ text: "✅ Obunani tekshirish", callback_data: "check_sub" }]
            ]
        },
        parse_mode: 'HTML'
    };
    await bot.sendMessage(chatId, `⚠️ <b>AstraxTV botidan foydalanish uchun avval quyidagi kanalimizga obuna bo'lishingiz kerak:</b>\n\nKanal: ${REQUIRED_CHANNEL}`, keyboard);
}

// /start buyrug'i
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    userState[chatId] = null;

    const isSubscribed = await checkSubscription(chatId, userId);
    if (!isSubscribed) return await sendSubWarning(chatId);

    try {
        if (fs.existsSync(bannerPath)) {
            await bot.sendPhoto(chatId, bannerPath, { caption: mainCaption, ...mainMenuKeyboard });
        } else {
            await bot.sendMessage(chatId, mainCaption, mainMenuKeyboard);
        }
    } catch (e) {
        await bot.sendMessage(chatId, mainCaption, mainMenuKeyboard);
    }
});

// /admin buyrug'i (faqat adminlar uchun)
bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!isAdmin(userId)) {
        return await bot.sendMessage(chatId, "❌ Siz bot admini emassiz.");
    }

    userState[chatId] = null;
    await bot.sendMessage(chatId, "🛠 <b>AstraxTV Admin Paneliga xush kelibsiz!</b>\n\nBoshqaruv tugmalaridan birini tanlang:", adminMenuKeyboard);
});

// VIDEO YOKI HUJJAT YUBORILGANDA FILE_ID NI OLISH (FAQAT ADMINLARGA)
bot.on('video', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!isAdmin(userId)) return;

    const fileId = msg.video.file_id;
    await bot.sendMessage(chatId, `🎥 <b>VIDEO FILE ID:</b>\n<code>${fileId}</code>\n\n<i>Ushbu ID'ni anime qo'shayotganda ishlating.</i>`, { parse_mode: 'HTML' });
});

bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!isAdmin(userId)) return;

    if (msg.document.mime_type && msg.document.mime_type.startsWith('video/')) {
        const fileId = msg.document.file_id;
        await bot.sendMessage(chatId, `📁 <b>DOCUMENT FILE ID:</b>\n<code>${fileId}</code>\n\n<i>Ushbu ID'ni anime qo'shayotganda ishlating.</i>`, { parse_mode: 'HTML' });
    }
});

// CALLBACK QUERY (Tugmalar)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const messageId = query.message.message_id;
    const data = query.data;

    try { await bot.answerCallbackQuery(query.id); } catch (e) {}

    // Obuna tekshirish
    if (data === 'check_sub') {
        const isSubscribed = await checkSubscription(chatId, userId);
        if (isSubscribed) {
            try { await bot.deleteMessage(chatId, messageId); } catch (e) {}
            await bot.sendMessage(chatId, "✅ Obuna tasdiqlandi!");
            if (fs.existsSync(bannerPath)) {
                await bot.sendPhoto(chatId, bannerPath, { caption: mainCaption, ...mainMenuKeyboard });
            } else {
                await bot.sendMessage(chatId, mainCaption, mainMenuKeyboard);
            }
        } else {
            await bot.sendMessage(chatId, "❌ Siz hali kanalga obuna bo'lmadingiz!");
        }
        return;
    }

    const backKeyboard = {
        reply_markup: { inline_keyboard: [[{ text: "⬅️ Ortga", callback_data: "btn_main_menu" }]] },
        parse_mode: 'HTML'
    };

    if (data === 'btn_main_menu') {
        userState[chatId] = null;
        try { await bot.deleteMessage(chatId, messageId); } catch (e) {}
        if (fs.existsSync(bannerPath)) {
            await bot.sendPhoto(chatId, bannerPath, { caption: mainCaption, ...mainMenuKeyboard });
        } else {
            await bot.sendMessage(chatId, mainCaption, mainMenuKeyboard);
        }
        return;
    }

    // --- ADMIN TUGMALARI ---
    if (isAdmin(userId)) {
        if (data === 'admin_add_anime') {
            userState[chatId] = { step: 'WAITING_ANIME_DATA' };
            return await bot.sendMessage(chatId, 
                "📝 <b>Yangi Anime Qo'shish</b>\n\nMa'lumotlarni quyidagi formatda yuboring:\n\n" +
                "<code>Nomi | Kodi | Turi | File_ID | Tavsif</code>\n\n" +
                "<b>Misol:</b>\n<code>Naruto 1-qism | 101 | Anime | BAACAgIAAxkBAAI... | Naruto sarguzashtlarining boshi</code>", 
                { parse_mode: 'HTML' }
            );
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
            return await bot.sendMessage(chatId, "👤 Yangi adminning Telegram **ID raqamini** yuboring:", { parse_mode: 'Markdown' });
        }

        if (data === 'admin_stats') {
            return await bot.sendMessage(chatId, `📊 <b>AstraxTV Bot Statistikasi:</b>\n\n🎬 Bazadagi animelar: <b>${animeData.length} ta</b>\n👥 Adminlar soni: <b>${ADMIN_IDS.length} ta</b>`, { parse_mode: 'HTML' });
        }
    }

    // Foydalanuvchi tugmalari
    try { await bot.deleteMessage(chatId, messageId); } catch (e) {}

    if (data === 'btn_code_search' || data === 'btn_anime') {
        userState[chatId] = 'SEARCHING';
        await bot.sendMessage(chatId, "🎬 Qidirayotgan animeningiz nomi yoki ID kodi kiritilsin:", backKeyboard);
    } else if (data === 'btn_guide') {
        await bot.sendMessage(chatId, "📚 <b>Qo'llanma:</b>\n\nKodingizni kiriting va anime videosiga ega bo'ling.", backKeyboard);
    } else if (data === 'btn_ad') {
        await bot.sendMessage(chatId, "📢 Reklama uchun: @thekzmv", backKeyboard);
    } else if (data === 'btn_list') {
        if (animeData.length === 0) {
            await bot.sendMessage(chatId, "📁 Hozircha AstraxTV bazasida animelar yo'q.", backKeyboard);
        } else {
            let listText = "📁 <b>Mavjud Animelar (AstraxTV):</b>\n\n";
            animeData.forEach((item, idx) => {
                listText += `${idx + 1}. <b>${item.title}</b> — Kodi: <code>${item.code}</code>\n`;
            });
            await bot.sendMessage(chatId, listText, backKeyboard);
        }
    }
});

// XABARLARNI QABUL QILISH VA QIDIRUV
bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();

    // --- ADMIN BUYRUQLARINI QABUL QILISH ---
    if (isAdmin(userId) && userState[chatId]) {
        // 1. Yangi Admin Qo'shish
        if (userState[chatId].step === 'WAITING_NEW_ADMIN_ID') {
            const newAdminId = text.trim();
            if (!ADMIN_IDS.includes(newAdminId)) {
                ADMIN_IDS.push(newAdminId);
                userState[chatId] = null;
                return await bot.sendMessage(chatId, `✅ <code>${newAdminId}</code> ID'li foydalanuvchi muvaffaqiyatli admin qilindi!`, { parse_mode: 'HTML' });
            } else {
                userState[chatId] = null;
                return await bot.sendMessage(chatId, "⚠️ Ushbu foydalanuvchi allaqachon adminlar ro'yxatida bor.");
            }
        }

        // 2. Yangi Anime Qo'shish
        if (userState[chatId].step === 'WAITING_ANIME_DATA') {
            const parts = text.split('|').map(p => p.trim());
            if (parts.length >= 4) {
                const [title, code, type, fileId, description] = parts;
                animeData.push({
                    id: Date.now().toString(),
                    title,
                    code,
                    type: type || 'Anime',
                    fileId: fileId || '',
                    description: description || ''
                });
                userState[chatId] = null;
                return await bot.sendMessage(chatId, `✅ <b>${title}</b> muvaffaqiyatli bazaga qo'shildi!\nKodi: <code>${code}</code>`, { parse_mode: 'HTML' });
            } else {
                return await bot.sendMessage(chatId, "❌ Noto'g'ri format! Iltimos, ajratuvchi sifatida `|` belgisidan foydalaning.\n\nFormati: `Nomi | Kodi | Turi | File_ID | Tavsif`", { parse_mode: 'Markdown' });
            }
        }
    }

    // --- FOYDALANUVCHILAR UCHUN QIDIRUV ---
    const isSubscribed = await checkSubscription(chatId, userId);
    if (!isSubscribed) return await sendSubWarning(chatId);

    const query = text.toLowerCase();

    const results = animeData.filter(item => 
        item.code.toLowerCase() === query || item.title.toLowerCase().includes(query)
    );

    if (results.length > 0) {
        for (let item of results) {
            let captionText = `🎬 <b>Nomi:</b> ${item.title}\n🆔 <b>Kodi:</b> <code>${item.code}</code>\n📌 <b>Turi:</b> ${item.type}`;
            if (item.description) {
                captionText += `\n\n💬 ${item.description}`;
            }

            if (item.fileId) {
                try {
                    await bot.sendVideo(chatId, item.fileId, { caption: captionText, parse_mode: 'HTML' });
                } catch (e) {
                    await bot.sendMessage(chatId, captionText, { parse_mode: 'HTML' });
                }
            } else {
                await bot.sendMessage(chatId, captionText, { parse_mode: 'HTML' });
            }
        }
    } else {
        await bot.sendMessage(chatId, "🔍 Kechirasiz, AstraxTV bazasidan ushbu kod yoki nom bo'yicha hech narsa topilmadi.");
    }
});

console.log("🚀 AstraxTV Telegram Boti muvaffaqiyatli ishga tushdi!");