const Subscription = require('../../database/subscriptions');
const { getDaysLeft } = require('../utils/helpers');

const sendReminderIfNeeded = async (client, sub) => {
    if (!sub.discord_id) return;

    const daysLeft = getDaysLeft(sub.end_date);
    if (daysLeft < 0) return;
    if (daysLeft > 7) return;

    try {
        const user = await client.users.fetch(sub.discord_id);
        await user.send(
            `Reminder: your subscription ends in ${daysLeft} day(s). Please renew to keep the bot active.`
        );
        sub.reminder_sent = true;
        await sub.save();
    } catch (err) {
        console.error('Failed to send reminder DM:', err.message || err);
    }
};

const checkExpiringSubscriptions = async (client) => {
    try {
        const subs = await Subscription.find({
            end_date: { $exists: true },
            reminder_sent: { $ne: true },
            is_banned: { $ne: true }
        });

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
