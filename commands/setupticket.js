const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Ticket = require('../models/Ticket');

module.exports = {
    name: 'setupticket',
    description: 'Setup the high-performance Ticket System with Transcripts',
    usage: '!setupticket <Category_ID> <Log_Channel_ID>',
    async execute(message, args) {
        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('<:cross:1367359614458396764> **Access Denied:** Administrator privileges required.');
        }

        const categoryId = args[0];
        const logChannelId = args[1];

        if (!categoryId || !logChannelId) {
            return message.reply('⚠️ **Usage Error:** Please provide both Category ID and Log Channel ID.\nExample: `!setupticket 123... 456...`');
        }

        const category = message.guild.channels.cache.get(categoryId);
        if (!category || category.type !== ChannelType.GuildCategory) {
            return message.reply('❌ **Validation Error:** Invalid Category ID provided.');
        }

        const logChannel = message.guild.channels.cache.get(logChannelId);
        if (!logChannel || (logChannel.type !== ChannelType.GuildText && logChannel.type !== ChannelType.GuildAnnouncement)) {
            return message.reply('❌ **Validation Error:** Invalid Log Channel ID provided.');
        }

        try {
            const mainEmbed = new EmbedBuilder()
                .setAuthor({
                    name: 'Wisdom Intelligence | Support Terminal',
                    iconURL: message.guild.iconURL({ dynamic: true })
                })
                .setTitle('<:roles:1360453046470967407> CENTRAL SUPPORT INFRASTRUCTURE')
                .setDescription(
                    `Welcome to the **Wisdom Circle Support Hub**. Select the appropriate department below to initialize a high-priority communication channel.\n\n` +
                    `<a:ArrowRightRGB:1453486894779338885> **AVAILABLE DEPARTMENTS**\n` +
                    `> 🛡️ **Security:** Incident reports & violations.\n` +
                    `> 🛠️ **Administrative:** General help & technical support.\n` +
                    `> 💡 **Initiative:** Suggestions & community ideas.\n\n` +
                    `<a:gear:1447323688092438738> **Policy:** Integrity and respect are mandatory protocols.`
                )
                .setColor('#2b2d31')
                .setImage('https://i.ibb.co/h1DBsRnv/ticket.gif')
                .setFooter({
                    text: 'WISDOM SUPPORT PROTOCOL | AUTHORED BY APOLLO',
                    iconURL: message.client.user.displayAvatarURL()
                })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_type_select')
                    .setPlaceholder('Select Department - اختر القسم')
                    .addOptions([
                        { label: 'Security & Report', description: 'File a report about a violation', value: 'report', emoji: '🛡️' },
                        { label: 'Technical Support', description: 'Get help with system features', value: 'support', emoji: '🛠️' },
                        { label: 'General Help', description: 'Ask for guidance or information', value: 'help', emoji: '📖' },
                        { label: 'System Suggestion', description: 'Propose an enhancement', value: 'suggest', emoji: '💡' },
                        { label: 'Other Inquiries', description: 'For everything else', value: 'other', emoji: '🌀' }
                    ])
            );

            await message.channel.send({ embeds: [mainEmbed], components: [row] });

            await Ticket.findOneAndUpdate(
                { guildId: message.guild.id },
                {
                    categoryId: categoryId,
                    logChannelId: logChannelId,
                    setupChannelId: message.channel.id
                },
                { upsert: true, new: true }
            );

            message.reply('<a:tick:1367359515204391025> **System Online:** Portal deployment successful with transcription logging enabled.');

        } catch (error) {
            console.error('Ticket Setup Error:', error);
            message.reply('❌ **Initialization Failed:** Check internal logs.');
        }
    },
};
