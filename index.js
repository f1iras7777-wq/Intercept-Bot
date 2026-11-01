const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// ضع هنا آي دي روم اللوغات (سجلات الحماية) الخاص بك
const LOG_CHANNEL_ID = 'ضع_آي_دي_الروم_هنا';

// روابط وأنماط الحماية المشبوهة
const maliciousPatterns = [
    /discordgg\//i,
    /free-nitro/i,
    /steam-gift/i,
    /nitro-giveaway/i,
    /grabify/i,
    /iplogger/i,
    /blasrc/i,
    /token-grabber/i
];

client.once('ready', () => {
    console.log(`تم تسجيل الدخول بنجاح باسم: ${client.user.tag}`);
    
    // تسجيل أمر !check اليدوي
    const commands = [
        {
            name: 'check',
            description: 'فحص يدوي لرابط أو ملف للتأكد من أمانه',
            options: [
                {
                    name: 'text',
                    type: 3, // String
                    description: 'الرابط أو النص المراد فحص أمانه',
                    required: true
                }
            ]
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    rest.put(Routes.applicationCommands(client.user.id), { body: commands })
        .then(() => console.log('تم تسجيل أمر /check بنجاح!'))
        .catch(console.error);
});

// مراقبة الرسائل تلقائياً للحماية (روابط ومرفقات مشبوهة)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    let isViolation = false;
    let reason = '';

    // 1. فحص الروابط والنصوص
    for (const pattern of maliciousPatterns) {
        if (pattern.test(message.content)) {
            isViolation = true;
            reason = 'تم اكتشاف رابط أو نص احتيالي/خبيث.';
            break;
        }
    }

    // 2. فحص المرفقات والملفات الخبيثة المخفية (مثل صور مدمجة باكسبلوريت أو ملفات تنفيدية)
    if (message.attachments.size > 0) {
        message.attachments.forEach(attachment => {
            const ext = attachment.name.split('.').pop().toLowerCase();
            // منع الملفات التنفيدية أو المرفقات المشبوهة
            if (['exe', 'scr', 'bat', 'cmd', 'vbs', 'jar', 'pif'].includes(ext)) {
                isViolation = true;
                reason = `تم اكتشاف ملف تنفيذي أو خطير مرفق (${attachment.name}).`;
            }
        });
    }

    // الإجراء الفوري في حال وجود خطر
    if (isViolation) {
        try {
            // حذف الرسالة الخبيثة فوراً
            await message.delete();

            // إعطاء المخالف ستاوت (7 أيام)
            const member = await message.guild.members.fetch(message.author.id);
            if (member && member.moderatable) {
                const SevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
                await member.timeout(SevenDaysInMs, 'نظام الحماية الآلي: نشر روابط أو ملفات خبيثة.');
            }

            // إرسال تقرير (Log) في روم اللوغات المخصص
            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🚨 تقرير حماية تلقائي - تم رصد خطر')
                    .setColor('#FF0000')
                    .addFields(
                        { name: 'المتسبب', value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
                        { name: 'السبب', value: reason, inline: true },
                        { name: 'الإجراءات المتخذة', value: '🗑️ حذف الرسالة\n⏳ إعطاء ستاوت (7 أيام)', inline: false }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('حدث خطأ أثناء معالجة رسالة خبيثة:', error);
        }
    }
});

// معالجة الأمر اليدوي /check
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'check') {
        const textToCheck = interaction.options.getString('text');
        let foundThreat = false;

        for (const pattern of maliciousPatterns) {
            if (pattern.test(textToCheck)) {
                foundThreat = true;
                break;
            }
        }

        if (foundThreat) {
            await interaction.reply({ content: '⚠️ **تحذير:** هذا الرابط/النص يبدو **مشبوهاً وخطيراً** ولا يُنصح بفتحه!', ephemeral: true });
        } else {
            await interaction.reply({ content: '✅ **سليم:** لم يتم رصد أي تهديدات واضحة في هذا النص.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
