const { EmbedBuilder } = require('discord.js');
const { loadJASettings, saveJASettings } = require('./ja.js');

module.exports = {
    name: 'setupja',
    description: 'Setup JA voice channel notification system',
    aliases: ['jasetup', 'setja'],
    async execute(message, args) {
        // Permissions are checked in messageCreate.js
        const channelId = args[0];
        
        if (!channelId) {
            const helpEmbed = new EmbedBuilder()
                .setTitle('⚙️ Setup JA System')
                .setDescription('Configure the channel for voice join notifications')
                .addFields({
                    name: '📝 Usage',
                    value: '`!setupja <channelid>`\n\n**Example:**\n`!setupja 1234567890123456789`',
                    inline: false
                })
                .setColor('#0099FF')
                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                .setTimestamp();
            return message.reply({ embeds: [helpEmbed] });
        }

        // Validate channel ID
        const channel = message.guild.channels.cache.get(channelId);
        if (!channel) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Invalid Channel')
                .setDescription('Channel not found! Please provide a valid channel ID.')
                .addFields({
                    name: '💡 How to get Channel ID',
                    value: '1. Enable Developer Mode in Discord settings\n2. Right-click the channel\n3. Select "Copy ID"',
                    inline: false
                })
                .setColor('#FF0000')
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }

        // Check if bot can send messages to the channel
        if (!channel.permissionsFor(message.guild.members.me).has(['SEND_MESSAGES', 'EMBED_LINKS'])) {
            const permErrorEmbed = new EmbedBuilder()
                .setTitle('❌ Permission Error')
                .setDescription(`I don't have permission to send messages in ${channel}!`)
                .addFields({
                    name: '🔧 Required Permissions',
                    value: '• Send Messages\n• Embed Links',
                    inline: false
                })
                .setColor('#FF0000')
                .setTimestamp();
            return message.reply({ embeds: [permErrorEmbed] });
        }

        // Save settings
        const guildId = message.guild.id;
        const settings = loadJASettings();
        
        if (!settings[guildId]) {
            settings[guildId] = {
                enabled: false,
                channelId: null
            };
        }
        
        settings[guildId].channelId = channelId;
        saveJASettings(settings);

        // Success embed
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ JA System Configured')
            .setDescription('Voice channel join notifications have been setup successfully!')
            .addFields(
                {
                    name: '📢 Notification Channel',
                    value: `${channel}`,
                    inline: true
                },
                {
                    name: '🔧 Status',
                    value: settings[guildId].enabled ? '✅ Enabled' : '❌ Disabled',
                    inline: true
                },
                {
                    name: '🎯 Next Steps',
                    value: settings[guildId].enabled ? '✅ System is ready!' : 'Use `!ja on` to enable notifications',
                    inline: false
                }
            )
            .setColor('#00FF00')
            .setTimestamp();
        
        message.reply({ embeds: [successEmbed] });

        // Send test message to configured channel
        const testEmbed = new EmbedBuilder()
            .setTitle('🎤 JA System Test')
            .setDescription('This channel has been configured for voice join notifications!')
            .addFields({
                name: '📋 What happens here?',
                value: 'When someone joins a voice channel, a notification will be sent here mentioning <@&1351406824753987594>',
                inline: false
            })
            .setColor('#0099FF')
            .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
            .setTimestamp();
        
        try {
            await channel.send({ embeds: [testEmbed] });
        } catch (error) {
            console.error('Error sending test message:', error);
        }
    }
};