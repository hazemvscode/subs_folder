require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const store = require('../database/store');
const ALLOWED_SERVER_ID = process.env.ALLOWED_SERVER_ID || '1085614826233016411';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Commands & Events
const subsCommand = require('./commands/subs');
const readyEvent = require('./events/ready');

client.once('ready', () => readyEvent(client));

const safeReply = async (interaction, options) => {
    try {
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(options);
        }
        return await interaction.reply(options);
    } catch (err) {
        // Ignore "Unknown interaction" or already-responded errors.
        return null;
    }
};

client.on('interactionCreate', async interaction => {
    try {
        if (!interaction.isChatInputCommand()) return;

        if (!interaction.guildId) {
            return safeReply(interaction, { content: 'Commands must be used inside a server.', ephemeral: true });
        }

        // Allow the authorized server to run commands without subscription check
        if (interaction.guildId === ALLOWED_SERVER_ID) {
            if (interaction.commandName === 'subs') return subsCommand(interaction, client);
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
            return safeReply(interaction, {
                content: 'No active subscription found for this server. Please subscribe to unlock commands.',
                ephemeral: true
            });
        }

        // If subscription is active, allow the command
        if (interaction.commandName === 'subs') return subsCommand(interaction, client);
    } catch (err) {
        console.error('interactionCreate error:', err);
    }
});

client.on('error', (err) => {
    console.error('Discord client error:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
});

if (!process.env.BOT_TOKEN) {
    console.error('Missing BOT_TOKEN environment variable.');
    process.exit(1);
}

client.login(process.env.BOT_TOKEN);
