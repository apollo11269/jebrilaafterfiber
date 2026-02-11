const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'banlist',
    description: 'Displays an organized archive of all banned entities.',
    async execute(message, args) {
        // Permission Check
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ **Security Protocol:** I require `BanMembers` permissions to access the archive.');
        }

        try {
            // Initial loading message
            const loadingMsg = await message.reply('🔍 **Accessing Wisdom Intelligence Archive...**');

            // Fetch all bans
            const bans = await message.guild.bans.fetch();

            if (bans.size === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setAuthor({ name: 'Wisdom Security Intelligence', iconURL: message.guild.iconURL({ dynamic: true }) })
                    .setTitle('🛡️ Ban Registry: Clear')
                    .setDescription('The server intelligence archive contains no records of banned entities. All systems nominal.')
                    .setColor('#2ecc71')
                    .setThumbnail('https://i.postimg.cc/7ZTV4hfL/image.png')
                    .setFooter({ text: 'Wisdom Team Infrastructure', iconURL: message.client.user.displayAvatarURL() })
                    .setTimestamp();

                return loadingMsg.edit({ content: null, embeds: [emptyEmbed] });
            }

            const banArray = Array.from(bans.values());
            const itemsPerPage = 10;
            const totalPages = Math.ceil(banArray.length / itemsPerPage);
            let currentPage = 0;

            const generateEmbed = (page) => {
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const currentBans = banArray.slice(start, end);

                const embed = new EmbedBuilder()
                    .setAuthor({ name: 'Wisdom Global Security Registry', iconURL: message.guild.iconURL({ dynamic: true }) })
                    .setTitle(`🔨 Banned Entities Archive [${banArray.length}]`)
                    .setDescription(`Displaying records of excluded individuals. Page **${page + 1}** of **${totalPages}**`)
                    .setColor('#ff4757')
                    .setThumbnail('https://i.postimg.cc/7ZTV4hfL/image.png')
                    .setFooter({ text: `Archive Request by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                    .setTimestamp();

                currentBans.forEach((ban, index) => {
                    const reason = ban.reason || 'Reason unclassified in logs.';
                    embed.addFields({
                        name: `${start + index + 1}. ${ban.user.tag}`,
                        value: `> **ID:** \`${ban.user.id}\`\n> **Cause:** \`${reason.length > 80 ? reason.substring(0, 80) + '...' : reason}\``,
                        inline: false
                    });
                });

                return embed;
            };

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(totalPages === 1)
            );

            const initialMsg = await loadingMsg.edit({
                content: null,
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
                if (interaction.customId === 'prev_page') {
                    currentPage--;
                } else if (interaction.customId === 'next_page') {
                    currentPage++;
                }

                const updatedRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('Back')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Forward')
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
            console.error('BanList Retrieval Error:', error);
            message.reply('❌ **Critical Failure:** Archive retrieval protocols encountered an internal error.');
        }
    },
};