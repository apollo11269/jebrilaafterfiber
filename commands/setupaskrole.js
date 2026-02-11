const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'setupaskrole',
    description: 'Setup the professional Role Requesting System',
    async execute(message, args) {
        const { getUserRoleLevel } = require('../utils/permissions.js');
        const userLevel = getUserRoleLevel(message.member);

        // Check for Admin permissions or Owner status
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && userLevel !== 'owner') {
            return message.reply({
                content: '❌ **Access Denied:** You need Administrator or Owner permissions to initialize this protocol.',
                ephemeral: true
            });
        }

        try {
            // 1. Create Role Request Submission Channel (Public)
            const askChannel = await message.guild.channels.create({
                name: '⚖-apply-for-roles',
                type: ChannelType.GuildText,
                topic: 'Community Identity & Permission Terminal',
                permissionOverwrites: [
                    {
                        id: message.guild.id,
                        allow: [PermissionFlagsBits.ViewChannel],
                        deny: [PermissionFlagsBits.SendMessages] // Only interaction via buttons
                    }
                ]
            });

            // 2. Create Moderator Review Channel (Private)
            const requestChannel = await message.guild.channels.create({
                name: '🔒-role-review-logs',
                type: ChannelType.GuildText,
                topic: 'Private Dossier Review for Role Applications',
                permissionOverwrites: [
                    {
                        id: message.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: message.guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.ManageRoles))?.id || message.author.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    }
                ]
            });

            // 3. Construct the Premium Setup Embed
            const mainEmbed = new EmbedBuilder()
                .setAuthor({
                    name: 'Wisdom Intelligence | Identity Upgrade Protocol',
                    iconURL: message.guild.iconURL({ dynamic: true })
                })
                .setTitle('<:roles:1360453046470967407> PERMISSION ACQUISITION TERMINAL')
                .setDescription(
                    `<a:waves:1360826963216044223> Welcome to the **Wisdom Circle Identity Hub**.\n` +
                    `Selected entities can request **Elevated Privileges** to enhance their contribution to our unified ecosystem.\n\n` +
                    `<a:ArrowRightRGB:1453486894779338885> **AVAILABLE ACCESS TIERS**\n` +
                    `> 🖼️ **Visual Alpha (Pic Perm):** Authority to share visual media.\n` +
                    `> 🎮 **Event Sync (Activities Perm):** Management rights for community activities.\n` +
                    `> 🔊 **Flow Control (Move Perm):** Ability to reposition members in voice.\n` +
                    `> 🔇 **Static Protocol (Mute Perm):** Right to enforce voice silence (Mute).\n` +
                    `> 🔗 **Dynamic Link (Link Perm):** Permission to distribute external links.\n\n` +
                    `<a:11pm_puffheart:1448728817207349430> **System Protocol:** Applications are strictly evaluated by the council. ` +
                    `Integrity is the only currency here. **لقد وضعنا ثقتنا فيكم، فكونوا أهلاً لها.**`
                )
                .addFields({
                    name: '<a:gear:1447323688092438738> SECURITY STANDARDS',
                    value: '```yaml\n- Protocol: Identity Verification\n- Record: Must remain pristine\n- Authorization: Final & Irrevocable\n```'
                })
                .setColor('#2b2d31')
                .setImage('https://i.postimg.cc/zv5D2hYn/Kawaii-Welcome.jpg')
                .setFooter({
                    text: 'IDENTITY PROTOCOL V3.0 | AUTHORED BY APOLLO',
                    iconURL: message.client.user.displayAvatarURL()
                })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ask_role_init')
                    .setLabel('INITIALIZE UPGRADE - بدء التقديم')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('1360835764807536702') // diamonda emoji id
            );

            await askChannel.send({ embeds: [mainEmbed], components: [row] });

            // 4. Final Response with IDs for .env
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ System Successfully Initialized')
                .setDescription(
                    `The Role Request system has been deployed.\n\n` +
                    `**1. Terminal Channel:** ${askChannel}\n` +
                    `**2. Review Logs:** ${requestChannel}\n\n` +
                    `> **CRITICAL:** To ensure the system functions correctly, please copy the ID below and put it in your \`.env\` file as \`role_request_id\`.\n\n` +
                    `\`role_request_id=${requestChannel.id}\``
                )
                .setColor('#2ecc71');

            message.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Setup Error:', error);
            message.reply('❌ **Initialization Failed:** Check bot permissions and try again.');
        }
    },
};
