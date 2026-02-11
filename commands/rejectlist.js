const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const Reject = require('../models/Reject');
require('dotenv').config();

module.exports = {
    name: 'rejectlist',
    description: 'Displays a paginated list of all users with the rejected role from MongoDB',
    async execute(message, args) {
        try {
            const rejectedRoleId = process.env.rejectedroleid;
            if (!rejectedRoleId) return message.reply('❌ The rejected role ID is not configured in the .env file.');

            const role = message.guild.roles.cache.get(rejectedRoleId);
            if (!role) return message.reply('❌ The configured rejected role could not be found.');

            await message.guild.members.fetch();
            const rejectedMembers = role.members.map(member => member);
            const totalCount = rejectedMembers.length;

            if (totalCount === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setAuthor({ name: 'Rejected Users Registry', iconURL: message.guild.iconURL({ dynamic: true }) })
                    .setDescription('### <a:admin:1452014173075669012> No records found\nThe blacklist is currently empty.')
                    .setColor('#2ecc71')
                    .setFooter({ text: 'Jebrila System | Security Protocol Active' })
                    .setTimestamp();
                return message.reply({ embeds: [emptyEmbed] });
            }

            // Fetch all rejects from MongoDB for this guild
            const guildRejects = await Reject.find({ guildId: message.guild.id });
            const rejectMap = new Map(guildRejects.map(r => [r.userId, r]));

            let currentPage = 0;
            const itemsPerPage = 8; // Using 8 for better vertical spacing
            const totalPages = Math.ceil(totalCount / itemsPerPage);

            const generateEmbed = (page) => {
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const membersToShow = rejectedMembers.slice(start, end);

                const fields = membersToShow.map((m, index) => {
                    const userData = rejectMap.get(m.id);
                    const reason = userData ? userData.reason : 'No reason specified';
                    const date = userData ? `<t:${Math.floor(new Date(userData.rejectedAt).getTime() / 1000)}:R>` : '`N/A`';
                    return {
                        name: `${start + index + 1}. ${m.user.tag}`,
                        value: `> **ID:** \`${m.id}\`\n> **Reason:** ${reason}\n> **Rejected:** ${date}`,
                        inline: false
                    };
                });

                return new EmbedBuilder()
                    .setAuthor({
                        name: `Security Registry | Entry ${start + 1} - ${Math.min(end, totalCount)}`,
                        iconURL: message.guild.iconURL({ dynamic: true })
                    })
                    .setTitle('<:security:1452014173075669012> Rejection Management Logs')
                    .setDescription(`Total restricted entities: \`${totalCount}\` members.\nShowing page \`${page + 1}\` of \`${totalPages}\`.`)
                    .addFields(fields)
                    .addFields({
                        name: '🛡️ Registry Status',
                        value: `Role: ${role} | Status: \`Active Compliance\``,
                        inline: false
                    })
                    .setColor('#2b2d31')
                    .setThumbnail('https://i.postimg.cc/26W3Kmqc/Goodbye.jpg')
                    .setFooter({
                        text: `Page ${page + 1}/${totalPages} | Jebrila System`,
                        iconURL: message.client.user.displayAvatarURL()
                    })
                    .setTimestamp();
            };

            const generateButtons = (page) => {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('Previous')
                        .setEmoji('◀️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next')
                        .setEmoji('▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages - 1)
                );
            };

            const response = await message.reply({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });

            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: '❌ Only the command executor can use these buttons.', ephemeral: true });
                }

                if (i.customId === 'prev') currentPage--;
                else if (i.customId === 'next') currentPage++;

                await i.update({
                    embeds: [generateEmbed(currentPage)],
                    components: [generateButtons(currentPage)]
                });
            });

            collector.on('end', () => {
                response.edit({ components: [] }).catch(() => { });
            });

        } catch (error) {
            console.error('Error in rejectlist command:', error);
            message.reply('❌ An error occurred during protocol execution.');
        }
    },
};
