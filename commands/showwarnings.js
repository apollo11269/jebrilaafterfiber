const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits } = require('discord.js');
const Warning = require('../models/Warning');

module.exports = {
    name: 'showwarnings',
    aliases: ['warnings', 'warns'],
    description: 'View premium warning records for a user or the entire server',
    async execute(message, args) {
        try {
            const canViewAll = message.member.permissions.has(PermissionFlagsBits.ManageMessages);
            const target = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);

            // CASE 1: NO TARGET PROVIDED - SHOW SERVER OVERVIEW
            if (!target) {
                if (!canViewAll) return message.reply('❌ **Error:** You do not have permission to view server-wide records.');

                const totalWarnings = await Warning.countDocuments({ guildId: message.guild.id });
                if (totalWarnings === 0) {
                    return message.reply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription('✨ **The Registry is Clear.** No active warnings found in this server.')] });
                }

                const topWarned = await Warning.aggregate([
                    { $match: { guildId: message.guild.id } },
                    { $group: { _id: "$userId", count: { $sum: 1 }, username: { $last: "$username" } } },
                    { $sort: { count: -1 } },
                    { $limit: 10 }
                ]);

                const overviewEmbed = new EmbedBuilder()
                    .setTitle('📊 Server Security Registry')
                    .setDescription(`Current server-wide disciplinary status. Total Warnings: \`${totalWarnings}\``)
                    .setColor('#2b2d31')
                    .setThumbnail(message.guild.iconURL({ dynamic: true }))
                    .addFields({
                        name: '🏆 Top Offenders',
                        value: topWarned.map((u, i) => `**${i + 1}.** ${u.username || 'Unknown'} (\`${u._id}\`) - \`${u.count}\` warns`).join('\n') || 'None',
                        inline: false
                    })
                    .setFooter({ text: 'Use !showwarnings @user for details' })
                    .setTimestamp();

                return message.reply({ embeds: [overviewEmbed] });
            }

            // CASE 2: TARGET PROVIDED - SHOW PAGINATED USER WARNINGS
            const userWarnings = await Warning.find({ guildId: message.guild.id, userId: target.id }).sort({ timestamp: -1 });
            const total = userWarnings.length;

            if (total === 0) {
                return message.reply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ **${target.tag}** has a pristine record. No warnings found.`)] });
            }

            let page = 0;
            const perPage = 5;
            const totalPages = Math.ceil(total / perPage);

            const generateEmbed = (p) => {
                const start = p * perPage;
                const end = start + perPage;
                const current = userWarnings.slice(start, end);

                const embed = new EmbedBuilder()
                    .setAuthor({ name: `Records for ${target.username}`, iconURL: target.displayAvatarURL({ dynamic: true }) })
                    .setTitle('🗂️ Disciplinary Archive')
                    .setDescription(`User has a total of \`${total}\` recorded offenses.`)
                    .setColor(total >= 3 ? '#ff4757' : '#ffa502')
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: `Page ${p + 1} of ${totalPages} | Security Registry` })
                    .setTimestamp();

                current.forEach((w, i) => {
                    embed.addFields({
                        name: `Case #${w._id.toString().slice(-6)} | <t:${Math.floor(w.timestamp / 1000)}:R>`,
                        value: `> **Reason:** ${w.reason}\n> **Moderator:** \`${w.moderator || 'Unknown'}\``,
                        inline: false
                    });
                });

                return embed;
            };

            if (totalPages === 1) {
                return message.reply({ embeds: [generateEmbed(0)] });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('next').setEmoji('▶️').setStyle(ButtonStyle.Secondary)
            );

            const initial = await message.reply({ embeds: [generateEmbed(0)], components: [row] });
            const collector = initial.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) return i.reply({ content: 'Not your menu!', ephemeral: true });

                if (i.customId === 'prev') page--;
                if (i.customId === 'next') page++;

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                    new ButtonBuilder().setCustomId('next').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1)
                );

                await i.update({ embeds: [generateEmbed(page)], components: [buttons] });
            });

            collector.on('end', () => {
                initial.edit({ components: [] }).catch(() => { });
            });

        } catch (error) {
            console.error(error);
            message.reply('❌ **System Error:** Failed to access the security archive.');
        }
    },
};