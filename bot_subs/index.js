require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const store = require('../database/store');
const ALLOWED_SERVER_ID = process.env.ALLOWED_SERVER_ID || '1085614826233016411';

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

    if (interaction.guildId !== ALLOWED_SERVER_ID) {
        return interaction.reply({
            content: 'This bot is only active for the authorized server.',
            ephemeral: true
        });
    }

    if (interaction.guildId === ALLOWED_SERVER_ID) {
        return;
    }

    const now = new Date();
    const activeSub = store.listSubscriptions().find(s => {
        const end = s.end_date ? new Date(s.end_date) : null;
        return s.server_id === interaction.guildId &&
            s.payment_status === 'active' &&
            end && end > now &&
            s.is_banned !== true;
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
