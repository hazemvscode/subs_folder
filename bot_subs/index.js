require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('../database/config');
const Subscription = require('../database/subscriptions');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Commands & Events
const subsCommand = require('./commands/subs');
const readyEvent = require('./events/ready');

client.once('ready', () => readyEvent(client));

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'subs') return subsCommand(interaction, client);

    if (!interaction.guildId) {
        return interaction.reply({ content: 'Commands must be used inside a server.', ephemeral: true });
    }

    if (mongoose.connection.readyState !== 1) {
        return interaction.reply({
            content: 'Database is offline. Please try again later.',
            ephemeral: true
        });
    }

    const now = new Date();
    const activeSub = await Subscription.findOne({
        server_id: interaction.guildId,
        payment_status: 'active',
        end_date: { $gt: now },
        is_banned: { $ne: true }
    });

    if (!activeSub) {
        return interaction.reply({
            content: 'No active subscription found for this server. Please subscribe to unlock commands.',
            ephemeral: true
        });
    }
});

if (!process.env.BOT_TOKEN) {
    console.error('Missing BOT_TOKEN environment variable.');
    process.exit(1);
}

client.login(process.env.BOT_TOKEN);
