const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'slowmode',
    description: 'Set slowmode for the current channel (in seconds)',
    async execute(message, args) {
        // Check if bot has manage channels permission
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ I don\'t have permission to manage channels!');
        }
        
        const seconds = parseInt(args[0]);
        
        if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
            return message.reply('❌ Please provide a valid number between 0 and 21600 seconds (6 hours)!');
        }
        
        try {
            await message.channel.setRateLimitPerUser(seconds, `Slowmode set by ${message.author.tag}`);
            
            const embed = new EmbedBuilder()
                .setTitle('⏱️ Slowmode Updated')
                .setDescription(`Slowmode has been ${seconds === 0 ? 'disabled' : `set to **${seconds}** seconds`} in this channel.`)
                .addFields(
                    { name: '📺 Channel', value: message.channel.toString(), inline: true },
                    { name: '👮 Moderator', value: message.author.tag, inline: true },
                    { name: '⏱️ Duration', value: seconds === 0 ? 'Disabled' : `${seconds} seconds`, inline: true }
                )
                .setColor(seconds === 0 ? '#00ff00' : '#ff9500')
                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                .setTimestamp();
            
            message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error setting slowmode:', error);
            message.reply('❌ An error occurred while trying to set slowmode.');
        }
    },
};