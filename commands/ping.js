const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ping',
    description: 'Shows bot latency',
    async execute(message, args) {
        const sent = await message.reply('🏓 Pinging...');
        
        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .setDescription('Bot latency information')
            .addFields(
                {
                    name: '📡 Bot Latency',
                    value: `${sent.createdTimestamp - message.createdTimestamp}ms`,
                    inline: true
                },
                {
                    name: '💓 API Latency',
                    value: `${Math.round(message.client.ws.ping)}ms`,
                    inline: true
                }
            )
            .setColor('#00ff00')
            .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
            .setTimestamp();
        
        sent.edit({ content: '', embeds: [embed] });
    },
};