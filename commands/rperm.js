const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'rperm',
    description: 'Remove specific channel permission overrides for a user',
    usage: '!rperm @user',
    async execute(message, args) {
        // Double check for Administrator permission (safety layer)
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('⛔ ليس لديك صلاحية لاستعمال هذا الأمر (يتطلب صلاحية مدير).');
        }

        const targetUser = message.mentions.members.first();
        if (!targetUser) {
            return message.reply('❌ يرجى منشن المستخدم المراد حذف صلاحياته منه. (مثال: `!rperm @user`)');
        }

        try {
            // Check if bot has permission to manage permissions in this channel
            if (!message.guild.members.me.permissionsIn(message.channel).has(PermissionFlagsBits.ManageRoles)) {
                return message.reply('❌ ليس لدي صلاحية `Manage Permissions` في هذه القناة للقيام بذلك.');
            }

            // Remove the specific permission overwrites for the user in this channel
            const overwrite = message.channel.permissionOverwrites.cache.get(targetUser.id);

            if (!overwrite) {
                return message.reply('⚠️ هذا المستخدم ليس لديه أي صلاحيات خاصة في هذه القناة حالياً.');
            }

            await overwrite.delete();

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Wisdom Security Terminal', iconURL: message.guild.iconURL({ dynamic: true }) })
                .setTitle('🚫 Authorization Revoked')
                .setDescription(`Special channel permissions for ${targetUser} have been removed.`)
                .addFields(
                    { name: '📍 Channel', value: `${message.channel}`, inline: true },
                    { name: '👤 User', value: `${targetUser.user.tag}`, inline: true },
                    { name: '🛡️ Revoked By', value: `${message.author.tag}`, inline: false }
                )
                .setColor('#ff4757')
                .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'Wisdom Premium Security Protocol' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error removing permission:', error);

            let errorMessage = '❌ فشل في حذف الصلاحية.';
            if (error.code === 50013) {
                errorMessage += '\n⚠️ السبب: ليس لدي صلاحيات كافية (Missing Permissions). تأكد من رفع رتبة البوت ومنحي صلاحية `Manage Roles`.';
            } else {
                errorMessage += `\n⚠️ الخطأ: \`${error.message}\``;
            }

            message.reply(errorMessage);
        }
    },
};
