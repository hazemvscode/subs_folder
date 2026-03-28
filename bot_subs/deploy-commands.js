require('dotenv').config();
const { REST, Routes } = require('discord.js');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID || '';

if (!token || !clientId) {
    console.error('Missing BOT_TOKEN or CLIENT_ID environment variables.');
    process.exit(1);
}

const commands = [
    {
        name: 'subs',
        description: 'Show your subscription time left'
    }
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log('Registered global slash commands.');

        if (guildId) {
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            console.log(`Cleared guild-only slash commands for ${guildId}.`);
        }
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();
