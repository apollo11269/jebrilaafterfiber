const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'disconnect',
    description: 'Disconnect a user from voice channels',
    async execute(message, args) {
        // Check if bot has move members permission (needed to disconnect)
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.MoveMembers)) {
            return message.reply('❌ I don\'t have permission to disconnect members!');
        }
        
        const target = message.mentions.users.first();
        if (!target) {
            return message.reply('❌ Please mention a user to disconnect!');
        }
        
        try {
            const member = await message.guild.members.fetch(target.id);
            
            // Check if target is the command author
            if (target.id === message.author.id) {
                return message.reply('❌ You cannot disconnect yourself!');
            }
            
            // Check if user is in a voice channel
            if (!member.voice.channel) {
                return message.reply('❌ This user is not in a voice channel!');
            }
            
            const voiceChannel = member.voice.channel;
            
            // Disconnect the user
            await member.voice.disconnect(`Disconnected by ${message.author.tag}`);
            
            const embed = new EmbedBuilder()
                .setTitle('📞 User Disconnected')
                .setDescription(`**${target.tag}** has been disconnected from voice channels.`)
                .addFields(
                    { name: '👤 User', value: `${target.tag} (${target.id})`, inline: true },
                    { name: '👮 Moderator', value: message.author.tag, inline: true },
                    { name: '🎵 Voice Channel', value: voiceChannel.name, inline: true }
                )
                .setColor('#ff4757')
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                .setTimestamp();
            
            message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error disconnecting user:', error);
            if (error.code === 10007) {
                message.reply('❌ User not found in this server!');
            } else {
                message.reply('❌ An error occurred while trying to disconnect the user.');
            }
        }
    },
};