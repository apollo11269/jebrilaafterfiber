const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'perm',
    description: 'Grant specific channel permissions to a user (Speak, Send Messages, Voice Activity, Video)',
    usage: '!perm @user',
    async execute(message, args) {
        // Double check for Administrator permission (safety layer)
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('⛔ ليس لديك صلاحية لاستعمال هذا الأمر (يتطلب صلاحية مدير).');
        }

        const targetUser = message.mentions.members.first();
        if (!targetUser) {
            return message.reply('❌ يرجى منشن المستخدم المراد منح الصلاحيات له. (مثال: `!perm @user`)');
        }

        try {
            // Check if bot has permission to manage permissions in this channel
            if (!message.guild.members.me.permissionsIn(message.channel).has(PermissionFlagsBits.ManageRoles)) {
                return message.reply('❌ ليس لدي صلاحية `Manage Permissions` في هذه القناة للقيام بذلك.');
            }

            // Check hierarchy
            if (message.guild.members.me.roles.highest.position <= targetUser.roles.highest.position && targetUser.id !== message.guild.ownerId) {
                // Note: Hierarchy usually applies to roles, but it's good practice to mention it if the action fails
                console.log('Hierarchy warning: Bot role is same or lower than target user.');
            }

            // Add permission overwrites for the target user in the current channel
            await message.channel.permissionOverwrites.edit(targetUser, {
                SendMessages: true,
                Speak: true,
                UseVAD: true,
                Stream: true
            });

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Wisdom Security Terminal', iconURL: message.guild.iconURL({ dynamic: true }) })
                .setTitle('💎 Authorization Granted')
                .setDescription(`The user ${targetUser} has been granted special permissions in this channel.`)
                .addFields(
                    { name: '📍 Channel', value: `${message.channel}`, inline: true },
                    { name: '👤 User', value: `${targetUser.user.tag}`, inline: true },
                    { name: '🛡️ Granted By', value: `${message.author.tag}`, inline: false },
                    { name: '✨ Privileges', value: '✅ Send Messages\n✅ Speak\n✅ Voice Activity\n✅ Video/Stream' }
                )
                .setColor('#2ecc71')
                .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'Wisdom Premium Security Protocol' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error granting permission:', error);

            let errorMessage = '❌ فشل في منح الصلاحية.';
            if (error.code === 50013) {
                errorMessage += '\n⚠️ السبب: ليس لدي صلاحيات كافية (Missing Permissions). تأكد من رفع رتبة البوت ومنحي صلاحية `Manage Roles`.';
            } else {
                errorMessage += `\n⚠️ الخطأ: \`${error.message}\``;
            }

            message.reply(errorMessage);
        }
    },
};
