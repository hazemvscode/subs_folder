const store = require('../../database/store');
const { getDaysLeft } = require('../utils/helpers');
const { EmbedBuilder } = require('discord.js');

const sendReminderIfNeeded = async (client, sub) => {
    if (!sub.discord_id) return;

    const daysLeft = getDaysLeft(sub.end_date);
    if (daysLeft < 0) return;
    if (daysLeft > 7) return;

    try {
        const user = await client.users.fetch(sub.discord_id);
        const embed = new EmbedBuilder()
            .setTitle('Subscription Reminder')
            .setDescription(`Your subscription ends in ${daysLeft} day(s).`)
            .addFields({ name: 'Next Step', value: 'Renew to keep the bot active.' })
            .setColor(0xff6b4a);
        await user.send({ embeds: [embed] });
        store.updateSubscriptionById(sub._id, { reminder_sent: true });
    } catch (err) {
        console.error('Failed to send reminder DM:', err.message || err);
    }
};

const checkExpiringSubscriptions = async (client) => {
    try {
        const subs = store.listSubscriptions().filter(s =>
            s.end_date &&
            s.reminder_sent !== true &&
            s.is_banned !== true
        );

        for (const sub of subs) {
            await sendReminderIfNeeded(client, sub);
        }
    } catch (err) {
        console.error('Reminder check failed:', err.message || err);
    }
};

module.exports = (client) => {
    console.log(`Bot online: ${client.user.tag}`);
    checkExpiringSubscriptions(client);
    setInterval(() => checkExpiringSubscriptions(client), 1000 * 60 * 60 * 24);
};
