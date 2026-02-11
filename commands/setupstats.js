const { PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const statsFile = path.join(__dirname, '..', 'data', 'server-stats.json');

// Helper to save stats config
function saveStatsConfig(config) {
    try {
        if (!fs.existsSync(path.dirname(statsFile))) {
            fs.mkdirSync(path.dirname(statsFile), { recursive: true });
        }
        fs.writeFileSync(statsFile, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving stats config:', error);
    }
}

module.exports = {
    name: 'setupstats',
    description: 'Set up server statistics channels (Total Members, Online, Voice)',
    async execute(message, args) {
        // Check permissions (Owner/Founders handled by permission system, but double check admin here for safety if permissions.js fails)
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need Administrator permissions to use this command.');
        }

        const guild = message.guild;

        try {
            await message.reply('⏳ Setting up server statistics channels...');

            // Create Category
            const category = await guild.channels.create({
                name: '📊 Server Stats',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.Connect], // Deny everyone from connecting
                        allow: [PermissionFlagsBits.ViewChannel] // Allow viewing
                    }
                ]
            });

            // Calculate initial stats
            const totalMembers = guild.memberCount;
            const onlineMembers = guild.members.cache.filter(m => !m.user.bot && m.presence && m.presence.status !== 'offline').size;
            // Note: guild.members.cache might not have all members unless fetched. fetch() is heavy but needed for accurate online count if intent is enabled.
            // For voice count
            const voiceCount = guild.members.cache.filter(m => m.voice.channel).size;

            // Create Channels
            const totalChannel = await guild.channels.create({
                name: `👥 All Members: ${totalMembers}`,
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.Connect]
                    }
                ]
            });

            const onlineChannel = await guild.channels.create({
                name: `🟢 Online: ${onlineMembers}`, // May require fetching members first for accuracy
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.Connect]
                    }
                ]
            });

            const voiceStatsChannel = await guild.channels.create({
                name: `🎤 In Voice: ${voiceCount}`,
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.Connect]
                    }
                ]
            });

            // Save Configuration
            const statsConfig = {
                [guild.id]: {
                    categoryId: category.id,
                    totalChannelId: totalChannel.id,
                    onlineChannelId: onlineChannel.id,
                    voiceChannelId: voiceStatsChannel.id
                }
            };

            // Merge with existing if any
            let existingConfig = {};
            if (fs.existsSync(statsFile)) {
                try {
                    existingConfig = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
                } catch (e) { }
            }

            saveStatsConfig({ ...existingConfig, ...statsConfig });

            const embed = new EmbedBuilder()
                .setTitle('✅ Server Stats Setup Complete')
                .setDescription('The statistics channels have been created and configured.')
                .addFields(
                    { name: 'Category', value: category.name, inline: true },
                    { name: 'Channels', value: 'All Members\nOnline Members\nVoice Users', inline: true },
                    { name: 'Note', value: 'These channels will update automatically every 10 minutes.', inline: false }
                )
                .setColor('#00ff00')
                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Error setupstats:', error);
            message.reply('❌ An error occurred while setting up stats channels.');
        }
    },
};
