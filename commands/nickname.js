const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'nickname',
    aliases: ['nick', 'smiya'],
    description: 'Change a user\'s nickname',
    async execute(message, args) {
        // Check if bot has manage nicknames permission
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            return message.reply('❌ I don\'t have permission to manage nicknames!');
        }
        
        const target = message.mentions.users.first();
        if (!target) {
            return message.reply('❌ Please mention a user!');
        }
        
        const newNickname = args.slice(1).join(' ');
        if (newNickname.length > 32) {
            return message.reply('❌ Nickname cannot be longer than 32 characters!');
        }
        
        try {
            const member = await message.guild.members.fetch(target.id);
            const oldNickname = member.nickname || member.user.username;
            
            // Check if target is the server owner
            if (target.id === message.guild.ownerId) {
                return message.reply('❌ I cannot change the server owner\'s nickname!');
            }
            
            // Check if bot can manage this member
            if (member.roles.highest.position >= message.guild.members.me.roles.highest.position) {
                return message.reply('❌ I cannot manage this user as their highest role is higher than or equal to mine!');
            }
            
            // Check if user can manage this member
            if (member.roles.highest.position >= message.member.roles.highest.position && message.author.id !== message.guild.ownerId) {
                return message.reply('❌ You cannot manage this user as their highest role is higher than or equal to yours!');
            }
            
            // Change the nickname
            await member.setNickname(newNickname || null, `Nickname changed by ${message.author.tag}`);
            
            const embed = new EmbedBuilder()
                .setTitle('✏️ Nickname Changed')
                .setDescription(`**${target.tag}**'s nickname has been updated.`)
                .addFields(
                    { name: '👤 User', value: `${target.tag} (${target.id})`, inline: true },
                    { name: '👮 Moderator', value: message.author.tag, inline: true },
                    { name: '📝 Old Nickname', value: oldNickname, inline: true },
                    { name: '📝 New Nickname', value: newNickname || 'None (Reset)', inline: true }
                )
                .setColor('#4834d4')
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                .setTimestamp();
            
            message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error changing nickname:', error);
            if (error.code === 10007) {
                message.reply('❌ User not found in this server!');
            } else {
                message.reply('❌ An error occurred while trying to change the nickname.');
            }
        }
    },
};