const { EmbedBuilder } = require('discord.js');
const Reject = require('../models/Reject');

module.exports = {
    name: 'unreject',
    description: 'Remove a user from the reject list using MongoDB',
    async execute(message, args) {
        let target;

        // Check for mentions first
        if (message.mentions.users.first()) {
            target = message.mentions.users.first();
        }
        // Check for user ID in args
        else if (args[0]) {
            const userId = args[0].replace(/[<@!>]/g, '');
            try {
                target = await message.client.users.fetch(userId);
            } catch (error) {
                return message.reply('❌ Invalid user ID or user not found!');
            }
        }

        if (!target) {
            return message.reply('❌ Please mention a user or provide a user ID to unreject!');
        }

        const guildId = message.guild.id;
        const userId = target.id;

        // Check if user is rejected in MongoDB
        const rejectData = await Reject.findOne({ guildId, userId });

        if (!rejectData) {
            return message.reply('❌ This user is not in the reject list!');
        }

        // Get target member
        const targetMember = await message.guild.members.fetch(userId).catch(() => null);
        if (!targetMember) {
            return message.reply('❌ User is not in this server!');
        }

        // Get rejected role ID from environment
        const rejectedRoleId = process.env.rejectedroleid;
        if (rejectedRoleId) {
            const rejectedRole = message.guild.roles.cache.get(rejectedRoleId);
            if (rejectedRole && targetMember.roles.cache.has(rejectedRoleId)) {
                try {
                    await targetMember.roles.remove(rejectedRole, `User unrejected by ${message.author.tag}`);
                } catch (roleError) {
                    console.error('Error removing rejected role:', roleError);
                }
            }
        }

        // Restore previous roles if they exist
        if (rejectData.previousRoles && rejectData.previousRoles.length > 0) {
            try {
                const validRoles = rejectData.previousRoles.filter(roleId => {
                    const role = message.guild.roles.cache.get(roleId);
                    return role && role.editable;
                });

                if (validRoles.length > 0) {
                    await targetMember.roles.add(validRoles, `Roles restored after unreject by ${message.author.tag}`);
                }
            } catch (roleError) {
                console.error('Error restoring roles:', roleError);
                message.reply('⚠️ Issue restoring some roles.');
            }
        }

        // Remove from MongoDB
        await Reject.deleteOne({ guildId, userId });

        const embed = new EmbedBuilder()
            .setTitle('✅ User Unrejected')
            .setDescription(`**${target.tag}** has been removed from the registry.`)
            .addFields(
                { name: '👤 User', value: `${target.tag} (${target.id})`, inline: true },
                { name: '👮 Moderator', value: message.author.tag, inline: true }
            )
            .setColor('#2ecc71')
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Jebrila System | Registry Updated' })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    },
};