const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'server',
    description: 'Shows server information',
    async execute(message, args) {
        const guild = message.guild;
        
        // Fetch guild to get accurate member count
        await guild.fetch();
        
        const embed = new EmbedBuilder()
            .setTitle(`🏰 Server Information - ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                {
                    name: '👑 Owner',
                    value: `<@${guild.ownerId}>`,
                    inline: true
                },
                {
                    name: '🆔 Server ID',
                    value: guild.id,
                    inline: true
                },
                {
                    name: '📅 Created',
                    value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
                    inline: false
                },
                {
                    name: '👥 Members',
                    value: guild.memberCount.toString(),
                    inline: true
                },
                {
                    name: '📺 Channels',
                    value: guild.channels.cache.size.toString(),
                    inline: true
                },
                {
                    name: '🎭 Roles',
                    value: guild.roles.cache.size.toString(),
                    inline: true
                },
                {
                    name: '😀 Emojis',
                    value: guild.emojis.cache.size.toString(),
                    inline: true
                },
                {
                    name: '🚀 Boosts',
                    value: `${guild.premiumSubscriptionCount || 0} (Level ${guild.premiumTier})`,
                    inline: true
                },
                {
                    name: '🔒 Verification Level',
                    value: guild.verificationLevel.toString(),
                    inline: true
                }
            )
            .setColor('#7289da')
            .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
            .setTimestamp();
        
        if (guild.banner) {
            embed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
        }
        
        message.reply({ embeds: [embed] });
    },
};