const mongoose = require('../../database/config');
const Subscription = require('../../database/subscriptions');
const { getTimeLeft } = require('../utils/helpers');

module.exports = async (interaction) => {
    if (mongoose.connection.readyState !== 1) {
        return interaction.reply({
            content: 'Database is offline. Please try again later.',
            ephemeral: true
        });
    }

    const userId = interaction.user.id;
    const userTag = interaction.user.tag;

    const banned = await Subscription.findOne({
        $or: [{ discord_id: userId }, { discord_tag: userTag }],
        is_banned: true
    });

    if (banned) {
        return interaction.reply({ content: 'Your account is banned. Contact support.', ephemeral: true });
    }

    const userSubs = await Subscription.find({
        $or: [{ discord_id: userId }, { discord_tag: userTag }],
        is_banned: { $ne: true }
    });

    if (!userSubs || userSubs.length === 0) {
        return interaction.reply({ content: 'No active subscriptions found.', ephemeral: true });
    }

    let replyMsg = 'Subscription time left:\n';
    userSubs.forEach(sub => {
        const timeLeft = getTimeLeft(sub.end_date);
        replyMsg += `Clan: ${sub.clan_name || 'N/A'} | Server: ${sub.server_id || 'N/A'} | ${timeLeft}\n`;
    });

    return interaction.reply({ content: replyMsg, ephemeral: true });
};
