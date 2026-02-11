const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const birthdaySettingsFile = path.join(__dirname, '..', 'data', 'birthday-settings.json');

// Load birthday settings from file
function loadBirthdaySettings() {
    try {
        if (fs.existsSync(birthdaySettingsFile)) {
            return JSON.parse(fs.readFileSync(birthdaySettingsFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading birthday settings:', error);
    }
    return {};
}

// Save birthday settings to file
function saveBirthdaySettings(settings) {
    try {
        fs.writeFileSync(birthdaySettingsFile, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error saving birthday settings:', error);
    }
}

module.exports = {
    name: 'setupbirthdays',
    description: 'Setup birthday reminder system for the server',
    async execute(message, args) {
        // Permissions are checked in messageCreate.js

        // Check if bot has necessary permissions
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply({ content: '❌ I need "Manage Channels" permission to create the birthday channel!', ephemeral: true });
        }

        try {
            const guildId = message.guild.id;
            const settings = loadBirthdaySettings();

            // Check if birthday system is already set up
            if (settings[guildId]) {
                const existingChannel = message.guild.channels.cache.get(settings[guildId].channelId);
                if (existingChannel) {
                    return message.reply({ content: `❌ Birthday system is already set up in ${existingChannel}!`, ephemeral: true });
                }
            }

            // Create the birthday channel
            const birthdayChannel = await message.guild.channels.create({
                name: '🎂⪼・birthdays',
                type: ChannelType.GuildText,
                topic: 'Birthday celebrations and reminders! 🎉',
                reason: `Birthday system setup by ${message.author.tag}`
            });

            // Save settings
            settings[guildId] = {
                channelId: birthdayChannel.id,
                setupBy: message.author.id,
                setupAt: Date.now(),
                birthdays: {}
            };
            saveBirthdaySettings(settings);

            // Create welcome embed for the birthday channel
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎂 Birthday Reminder System')
                .setDescription('Welcome to the birthday channel! Here\'s how to use it:')
                .addFields(
                    {
                        name: '🎉 Add Your Birthday',
                        value: 'Use `!addbirthday DD/MM` to register your birthday\nExample: `!addbirthday 15/03` for March 15th',
                        inline: false
                    },
                    {
                        name: '📅 View Birthdays',
                        value: 'Use `!birthdays` to see all upcoming birthdays',
                        inline: false
                    },
                    {
                        name: '🗑️ Remove Birthday',
                        value: 'Use `!removebirthday` to remove your birthday from the list',
                        inline: false
                    }
                )
                .setColor('#FF69B4')
                .setThumbnail('https://cdn.discordapp.com/emojis/🎂.png')
                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                .setTimestamp();

            await birthdayChannel.send({ embeds: [welcomeEmbed] });

            // Success embed
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Birthday System Setup Complete!')
                .setDescription(`Birthday reminder system has been successfully set up!`)
                .addFields(
                    { name: '📍 Channel Created', value: `${birthdayChannel}`, inline: true },
                    { name: '👮 Setup by', value: message.author.tag, inline: true },
                    { name: '🎯 Next Steps', value: 'Users can now add their birthdays using `!addbirthday DD/MM`', inline: false }
                )
                .setColor('#00ff00')
                .setThumbnail(message.guild.iconURL({ dynamic: true }))
                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                .setTimestamp();

            message.reply({ embeds: [successEmbed], ephemeral: true });

        } catch (error) {
            console.error('Error setting up birthday system:', error);
            message.reply({ content: '❌ There was an error setting up the birthday system!', ephemeral: true });
        }
    },
};

// Export functions for use in other files
module.exports.loadBirthdaySettings = loadBirthdaySettings;
module.exports.saveBirthdaySettings = saveBirthdaySettings;