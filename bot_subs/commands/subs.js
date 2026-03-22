const store = require('../../database/store');
const { getTimeLeft } = require('../utils/helpers');
const { EmbedBuilder } = require('discord.js');

module.exports = async (interaction) => {
    const userId = interaction.user.id;
    const userTag = interaction.user.tag;

    const subsAll = store.listSubscriptions();
    const banned = subsAll.find(s =>
        (s.discord_id === userId || s.discord_tag === userTag) &&
        s.is_banned === true
    );

    if (banned) {
        return interaction.reply({ content: 'Your account is banned. Contact support.', ephemeral: true });
    }

    const userSubs = subsAll.filter(s =>
        (s.discord_id === userId || s.discord_tag === userTag) &&
        s.is_banned !== true
    );

    if (!userSubs || userSubs.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setTitle('Subscription Status')
            .setDescription('No active subscriptions found yet.')
            .setColor(0xff6b4a);
        return interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle('Your Subscription Status')
        .setDescription('Here is your current access overview.')
        .setColor(0xff6b4a);

    userSubs.forEach(sub => {
        const timeLeft = getTimeLeft(sub.end_date);
        const plan = sub.subscription_type ? sub.subscription_type.toUpperCase() : 'N/A';
        const status = sub.payment_status || 'pending';
        embed.addFields({
            name: sub.clan_name || 'Clan',
            value: `Server: ${sub.server_id || 'N/A'}\nPlan: ${plan}\nTime left: ${timeLeft}\nStatus: ${status}`,
            inline: false
        });
    });

    return interaction.reply({ embeds: [embed], ephemeral: true });
};
