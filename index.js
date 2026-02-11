const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Connection
if (process.env.MONGODB_URI) {
    const connectDB = async () => {
        try {
            await mongoose.connect(process.env.MONGODB_URI, {
                serverSelectionTimeoutMS: 5000,
            });
            console.log('🍃 Connected to MongoDB Successfully!');
        } catch (err) {
            console.error('❌ MongoDB Connection Error:', err.message);
            console.log('💡 Tip: Ensure your IP is whitelisted in MongoDB Atlas (Network Access -> 0.0.0.0/0).');
            // Try again in 30 seconds
            setTimeout(connectDB, 30000);
        }
    };
    connectDB();
} else {
    console.warn('⚠️ MONGODB_URI not found in .env file. Database features will be disabled.');
}

// Create Express app for Render hosting
const app = express();
const PORT = process.env.PORT || 3000;

// Basic route to keep the service alive
app.get('/', (req, res) => {
    res.json({
        status: 'Bot is running!',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        bot: 'WisdomJebril V3 By APollo <3'
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`🌐 HTTP Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.User, Partials.GuildMember, Partials.Channel]
});

// Create collections for commands
client.commands = new Collection();
client.prefix = '!';

// Load command files
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if ('name' in command && 'execute' in command) {
            client.commands.set(command.name, command);

            // Set aliases if they exist
            if (command.aliases) {
                command.aliases.forEach(alias => {
                    client.commands.set(alias, command);
                });
            }
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "name" or "execute" property.`);
        }
    }
}

// Load event files
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
}

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log('🤖 Discord bot logged in successfully!');
}).catch(error => {
    console.error('❌ Failed to login to Discord:', error);
    process.exit(1);
});

// Global error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});