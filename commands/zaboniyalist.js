const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { loadExemptions } = require('./zaboniya.js');

module.exports = {
    name: 'zaboniyalist',
    description: 'Displays the list of entities authorized with VIP Immunity.',
    async execute(message, args) {
        try {
            const exemptions = loadExemptions();
            const guildId = message.guild.id;
            const userIds = exemptions[guildId] || [];

            if (userIds.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setTitle('🛡️ VIP Immunity Registry')
                    .setDescription('The VIP registry is currently empty. No entities are currently exempted from moderation.')
                    .setColor('#95a5a6')
                    .setFooter({ text: 'Wisdom Security Systems' });

                return message.reply({ embeds: [emptyEmbed] });
            }

            const itemsPerPage = 10;
            const totalPages = Math.ceil(userIds.length / itemsPerPage);
            let currentPage = 0;

            const generateEmbed = (page) => {
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const currentIds = userIds.slice(start, end);

                const embed = new EmbedBuilder()
                    .setAuthor({ name: 'Wisdom VIP Intelligence Archive', iconURL: message.guild.iconURL({ dynamic: true }) })
                    .setTitle(`💎 Authorization Registry [${userIds.length}]`)
                    .setDescription(`Registered entities exempt from automated enforcement. Page **${page + 1}/${totalPages}**`)
                    .setColor('#f1c40f')
                    .setThumbnail('https://i.postimg.cc/7ZTV4hfL/image.png')
                    .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() });

                const list = currentIds.map((id, index) => {
                    const member = message.guild.members.cache.get(id);
                    const tag = member ? `**${member.user.tag}**` : `\`Unknown Entity\``;
                    return `${start + index + 1}. ${tag} (\`${id}\`)`;
                }).join('\n');

                embed.addFields({ name: '📝 Authorized Individuals', value: list });
                return embed;
            };

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_plus')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next_plus')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(totalPages === 1)
            );

            const initialMsg = await message.reply({
                embeds: [generateEmbed(0)],
                components: totalPages > 1 ? [row] : []
            });

            if (totalPages === 1) return;

            const collector = initialMsg.createMessageComponentCollector({
                filter: (i) => i.user.id === message.author.id,
                time: 60000,
                componentType: ComponentType.Button
            });

            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'prev_plus') currentPage--;
                else if (interaction.customId === 'next_plus') currentPage++;

                const updatedRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_plus')
                        .setLabel('Back')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('next_plus')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === totalPages - 1)
                );

                await interaction.update({
                    embeds: [generateEmbed(currentPage)],
                    components: [updatedRow]
                });
            });

            collector.on('end', () => {
                initialMsg.edit({ components: [] }).catch(() => { });
            });

        } catch (error) {
            console.error('Error in zaboniyalist command:', error);
            message.reply('❌ **System Failure:** Unable to retrieve the VIP registry.');
        }
    },
};
