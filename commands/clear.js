const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'clear',
    aliases: ['mse7'],
    description: 'Delete multiple messages from the channel',
    async execute(message, args) {
        // Check if bot has manage messages permission
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ I don\'t have permission to manage messages!');
        }
        
        const amount = parseInt(args[0]);
        
        if (!amount || isNaN(amount)) {
            return message.reply('❌ Please provide a valid number of messages to delete!');
        }
        
        if (amount < 1 || amount > 100) {
            return message.reply('❌ Please provide a number between 1 and 100!');
        }
        
        try {
            // Delete the command message first
            await message.delete();
            
            // Fetch and delete messages
            const messages = await message.channel.messages.fetch({ limit: amount });
            const deletedMessages = await message.channel.bulkDelete(messages, true);
            
            const embed = new EmbedBuilder()
                .setTitle('🗑️ Messages Cleared')
                .setDescription(`Successfully deleted **${deletedMessages.size}** messages.`)
                .addFields(
                    { name: '👮 Moderator', value: message.author.tag, inline: true },
                    { name: '📝 Channel', value: message.channel.name, inline: true },
                    { name: '🔢 Amount', value: deletedMessages.size.toString(), inline: true }
                )
                .setColor('#ff6b6b')
                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                .setTimestamp();
            
            // Send confirmation message and delete it after 5 seconds
            const confirmMessage = await message.channel.send({ embeds: [embed] });
            setTimeout(() => {
                confirmMessage.delete().catch(() => {});
            }, 5000);
            
        } catch (error) {
            console.error('Error clearing messages:', error);
            if (error.code === 50034) {
                message.channel.send('❌ Cannot delete messages older than 14 days!').then(msg => {
                    setTimeout(() => msg.delete().catch(() => {}), 5000);
                });
            } else {
                message.channel.send('❌ An error occurred while trying to clear messages.').then(msg => {
                    setTimeout(() => msg.delete().catch(() => {}), 5000);
                });
            }
        }
    },
};