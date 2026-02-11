const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Warning = require('../models/Warning');

module.exports = {
    name: 'removewarn',
    aliases: ['delwarn', 'unwarn'],
    description: 'Delete a specific warning or clear all warnings for a user',
    async execute(message, args) {
        try {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return message.reply('❌ **Error:** Access Denied. Required Permission: `Manage Messages`.');
            }

            const target = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
            if (!target) {
                return message.reply('❌ **Error:** Please specify a user to purge warnings for.');
            }

            const guildId = message.guild.id;
            const userId = target.id;

            // Check if user has warnings
            const warnCount = await Warning.countDocuments({ guildId, userId });
            if (warnCount === 0) {
                return message.reply(`✅ **${target.tag}** already has a clean record.`);
            }

            // Remove all records from MongoDB
            const result = await Warning.deleteMany({ guildId, userId });

            const clearEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Registry Maintenance', iconURL: target.displayAvatarURL({ dynamic: true }) })
                .setTitle('🧹 System Registry Purged')
                .setDescription(
                    `Successfully cleared all disciplinary records for **${target.tag}**.\n\n` +
                    `> **Entries Removed:** \`${result.deletedCount}\`\n` +
                    `> **Updated Status:** ✅ Pristine Record\n` +
                    `> **Authorized By:** ${message.author}`
                )
                .setColor('#2ecc71')
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'Jebrila Security | Registry Clean' })
                .setTimestamp();

            await message.reply({ embeds: [clearEmbed] });

        } catch (error) {
            console.error('[RemoveWarn Error]:', error);
            message.reply('❌ **System Error:** Failed to execute registry maintenance.');
        }
    },
};