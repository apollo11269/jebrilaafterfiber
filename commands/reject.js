const { EmbedBuilder } = require('discord.js');
const Reject = require('../models/Reject');

module.exports = {
    name: 'reject',
    description: 'Reject a user and log it to MongoDB',
    async execute(message, args) {
        // ID is required first
        if (!args[0]) {
            return message.reply('❌ Please provide a User ID to reject! Usage: `!reject <user_id> <reason>`');
        }

        // Validate ID format
        const targetId = args[0].replace(/[<@!>]/g, '');
        if (!/^\d+$/.test(targetId)) {
            return message.reply('❌ Invalid User ID provided!');
        }

        // Reason is required
        const reason = args.slice(1).join(' ');
        if (!reason) {
            return message.reply('❌ A reason is **required** to reject a user!');
        }

        const channelId = process.env.reject_channel_id;
        if (!channelId) {
            return message.reply('❌ Reject channel ID is not configured!');
        }

        try {
            const rejectChannel = await message.client.channels.fetch(channelId).catch(() => null);
            if (!rejectChannel) {
                return message.reply('❌ Reject channel not found!');
            }

            // Get target member
            const targetMember = await message.guild.members.fetch(targetId).catch(() => null);
            if (!targetMember) {
                return message.reply('❌ User is not in this server!');
            }

            const target = targetMember.user;
            const rejectedRoleId = process.env.rejectedroleid;
            const rejectedRole = message.guild.roles.cache.get(rejectedRoleId);

            if (!rejectedRole) {
                return message.reply('❌ Rejected role not found!');
            }

            // Store user's current roles
            const userRoles = targetMember.roles.cache
                .filter(role => role.id !== message.guild.id)
                .map(role => role.id);

            // SAVE TO MONGODB
            await Reject.findOneAndUpdate(
                { guildId: message.guild.id, userId: targetId },
                {
                    username: target.tag,
                    rejectedBy: message.author.tag,
                    rejectedById: message.author.id,
                    reason: reason,
                    rejectedAt: new Date(),
                    previousRoles: userRoles
                },
                { upsert: true, new: true }
            );

            console.log(`[Database] Rejection saved for ${target.tag} in MongoDB`);

            try {
                // Remove all roles from user (except @everyone)
                if (userRoles.length > 0) {
                    try {
                        await targetMember.roles.remove(userRoles, `User rejected by ${message.author.tag}`);
                        console.log(`Removed ${userRoles.length} roles from ${target.tag}`);
                    } catch (roleError) {
                        console.error('Error removing roles:', roleError);
                        message.reply('⚠️ User rejected but there was an issue removing some roles.');
                    }
                }

                // Add rejected role
                try {
                    await targetMember.roles.add(rejectedRole, `User rejected by ${message.author.tag}`);
                    console.log(`Added rejected role to ${target.tag}`);
                } catch (roleError) {
                    console.error('Error adding rejected role:', roleError);
                    return message.reply('❌ Failed to add rejected role. Please check bot permissions and role hierarchy.');
                }

                // Remove user from current voice channel if they're in one
                if (targetMember.voice.channel) {
                    try {
                        await targetMember.voice.disconnect('User rejected');
                    } catch (voiceError) {
                        console.error('Error disconnecting user from voice:', voiceError);
                    }
                }

                // Send to reject channel
                const rejectEmbed = new EmbedBuilder()
                    .setTitle('❌ User Rejected')
                    .setDescription(`**${target.tag}** has been rejected and all roles removed.`)
                    .addFields(
                        { name: '👤 User', value: `${target.tag} (${targetId})`, inline: true },
                        { name: '👮 Rejected by', value: message.author.tag, inline: true },
                        { name: '📝 Reason', value: reason, inline: false },
                        { name: '🗑️ Roles Removed', value: `${userRoles.length} role(s)`, inline: true },
                        { name: '🏷️ Rejected Role', value: rejectedRole.toString(), inline: true },
                        { name: '📅 Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setColor('#ff4757')
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                    .setTimestamp();

                await rejectChannel.send({ embeds: [rejectEmbed] });

                // Send beautiful DM to user
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('🚫 تم رفضك من السيرفر')
                        .setDescription(`**عذراً**، تم رفضك من سيرفر **${message.guild.name}**\n\nتم إزالة جميع الرتب الخاصة بك من السيرفر.`)
                        .addFields(
                            {
                                name: '📋 السبب',
                                value: reason.length > 1024 ? reason.substring(0, 1021) + '...' : reason,
                                inline: false
                            },
                            {
                                name: '💬 للمزيد من المعلومات',
                                value: 'يرجى التواصل مع **فريق Wisdom Team** لمعرفة المزيد حول هذا القرار.',
                                inline: false
                            }
                        )
                        .setColor('#ff4757')
                        .setThumbnail(message.guild.iconURL({ dynamic: true, size: 256 }))
                        .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                        .setTimestamp();

                    await target.send({ embeds: [dmEmbed] });
                    console.log(`✅ DM sent to ${target.tag}`);
                } catch (dmError) {
                    console.log(`❌ Could not send DM to ${target.tag}:`, dmError.message);
                }

            } catch (error) {
                console.error('Error processing rejection:', error);
                message.reply('❌ An error occurred while processing the rejection.');
                return;
            }

            // Confirmation message
            const confirmEmbed = new EmbedBuilder()
                .setTitle('✅ User Rejected')
                .setDescription(`**${target.tag}** has been rejected and logged.`)
                .addFields(
                    { name: '👤 User', value: `${target.tag} (${targetId})`, inline: true },
                    { name: '👮 Moderator', value: message.author.tag, inline: true }
                )
                .setColor('#ff4757')
                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                .setTimestamp();

            message.reply({ embeds: [confirmEmbed] });

        } catch (error) {
            console.error('Error rejecting user:', error);
            message.reply('❌ An error occurred while rejecting the user.');
        }
    },
};