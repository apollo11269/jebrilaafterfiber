const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['commands', 'menu', 'h'],
    description: 'Access the advanced community command registry',
    execute(message, args) {
        // High-end Main Registry Embed
        const mainEmbed = new EmbedBuilder()
            .setAuthor({
                name: `Wisdom Circle | Command Registry`,
                iconURL: message.client.user.displayAvatarURL()
            })
            .setTitle('<:admin:1452014173075669012> System Intelligence Hub')
            .setDescription(
                `Welcome to the **Jebrila V3** intelligence interface. Use the navigational components below to explore our community's capabilities and moderation protocols.\n\n` +
                `### 🛠️ Core Infrastructure\n` +
                `<:asinexegiveweays:1361729576828407828> **Global Prefix:** \`!\`\n` +
                `<:security:1452014173075669012> **Security Protocol:** \`AES-256 Cloud Sync\`\n` +
                `<:11pm_puffheart:1448728817207349430> **System Status:** \`Operational - 99.9% Uptime\``
            )
            .addFields(
                {
                    name: '📊 Registry Data',
                    value: `\`\`\`yaml\nCommands: 60+\nModules: 12\nLatency: Online\n\`\`\``,
                    inline: true
                },
                {
                    name: '👑 Management',
                    value: `\`\`\`yaml\nAuth: By APOllO\nVersion: 6.9\nRegion: Global\n\`\`\``,
                    inline: true
                }
            )
            .setImage('https://i.postimg.cc/zv5D2hYn/Kawaii-Welcome.jpg') // Elegant welcome visual
            .setColor('#2b2d31')
            .setFooter({
                text: 'Jebrila Intelligence System | Authorization Required',
                iconURL: message.guild.iconURL({ dynamic: true })
            })
            .setTimestamp();

        // Refined Selection Menu
        const categorySelect = new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('📂 Browse specialized command modules...')
            .addOptions([
                {
                    label: 'Security & Moderation',
                    description: 'Enforcement protocols, bans, and kicks.',
                    value: 'moderation',
                    emoji: '🛡️'
                },
                {
                    label: 'Administration Tools',
                    description: 'Server configuration and channel control.',
                    value: 'management',
                    emoji: '⚙️'
                },
                {
                    label: 'Intelligence Archive',
                    description: 'User data, server stats, and registries.',
                    value: 'information',
                    emoji: '📂'
                },
                {
                    label: 'Voice Core',
                    description: 'Advanced voice channel manipulation.',
                    value: 'voice',
                    emoji: '🔊'
                },
                {
                    label: 'Social & Birthdays',
                    description: 'Community events and celebrations.',
                    value: 'birthday',
                    emoji: '🎉'
                },
                {
                    label: 'Reporting Analytics',
                    description: 'Incident reporting and status tracking.',
                    value: 'report',
                    emoji: '📝'
                },
                {
                    label: 'Advanced Modules',
                    description: 'Specialized system utilities.',
                    value: 'special',
                    emoji: '💎'
                }
            ]);

        const quickButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('help_moderation').setLabel('Security').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId('help_management').setLabel('Admin').setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
            new ButtonBuilder().setCustomId('help_special').setLabel('Special').setStyle(ButtonStyle.Secondary).setEmoji('💎'),
            new ButtonBuilder().setCustomId('help_all_commands').setLabel('Full Index').setStyle(ButtonStyle.Primary).setEmoji('📖')
        );

        const navButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('help_refresh').setLabel('Master Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
            new ButtonBuilder().setLabel('Technical Support').setStyle(ButtonStyle.Link).setURL('https://discord.gg/wisdomcircle').setEmoji('🆘'),
            new ButtonBuilder().setLabel('System Invitation').setStyle(ButtonStyle.Link).setURL('https://discord.com/api/oauth2/authorize?client_id=1439699587836154078&permissions=8&scope=bot').setEmoji('🔗')
        );

        const selectRow = new ActionRowBuilder().addComponents(categorySelect);

        message.reply({
            embeds: [mainEmbed],
            components: [selectRow, quickButtons, navButtons]
        });
    },
};