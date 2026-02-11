const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { loadApplySettings } = require('../commands/setupapply');
const RoleRequest = require('../models/RoleRequest');
const Ticket = require('../models/Ticket');
const mongoose = require('mongoose');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Handle button interactions
        if (interaction.isButton()) {
            const { customId } = interaction;

            // Handle staff application buttons
            if (customId.startsWith('apply_')) {
                const language = customId.split('_')[1];

                // Create modal based on selected language
                const modal = new ModalBuilder()
                    .setCustomId(`apply_modal_${language}`)
                    .setTitle(getModalTitle(language));

                const questions = getQuestions(language);
                const components = [];

                // Create text inputs for each question (Discord modals support max 5 components)
                for (let i = 0; i < Math.min(5, questions.length); i++) {
                    const textInput = new TextInputBuilder()
                        .setCustomId(`question_${i + 1}`)
                        .setLabel(questions[i].substring(0, 45)) // Discord label limit
                        .setPlaceholder(questions[i].substring(0, 100)) // Discord placeholder limit
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(1000);

                    const actionRow = new ActionRowBuilder().addComponents(textInput);
                    components.push(actionRow);
                }

                modal.addComponents(...components);
                try {
                    await interaction.showModal(modal);
                } catch (error) {
                    console.error('Error showing modal:', error);
                    await interaction.reply({
                        content: 'There was an error displaying the application form. Please try again.',
                        ephemeral: true
                    });
                }
                return;
            }

            // --- TICKET SYSTEM: CLOSE TICKET ---
            if (customId === 'ticket_close') {
                await interaction.reply({ content: '<a:loading:1361472044256071710> **Initializing Session Termination...** Generating transcript and purging data in 5 seconds.', ephemeral: false });

                try {
                    const ticketConfig = await Ticket.findOne({ guildId: interaction.guild.id });

                    // Generate Transcript
                    const messages = await interaction.channel.messages.fetch({ limit: 100 });
                    let transcript = `WISDOM TICKET TRANSCRIPT | SESSION: ${interaction.channel.name}\n`;
                    transcript += `CLOSED BY: ${interaction.user.tag} (${interaction.user.id})\n`;
                    transcript += `DATE: ${new Date().toLocaleString()}\n`;
                    transcript += `==========================================\n\n`;

                    messages.reverse().forEach(msg => {
                        const time = msg.createdAt.toLocaleString();
                        transcript += `[${time}] ${msg.author.tag}: ${msg.content || (msg.attachments.size > 0 ? '[Attachment]' : '[Embed]')}\n`;
                    });

                    const transcriptBuffer = Buffer.from(transcript, 'utf-8');
                    const attachment = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${interaction.channel.name}.txt` });

                    if (ticketConfig && ticketConfig.logChannelId) {
                        const logChannel = interaction.guild.channels.cache.get(ticketConfig.logChannelId);
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setAuthor({ name: 'Security Registry | Session Archived', iconURL: interaction.guild.iconURL({ dynamic: true }) })
                                .setTitle('<a:gear:1447323688092438738> TRANSCRIPT LOG GENERATED')
                                .setDescription(
                                    `**Channel:** \`${interaction.channel.name}\`\n` +
                                    `**Closed By:** ${interaction.user}\n` +
                                    `**Messages Captured:** \`${messages.size}\``
                                )
                                .setColor('#2b2d31')
                                .setTimestamp();

                            await logChannel.send({ embeds: [logEmbed], files: [attachment] });
                        }
                    }
                } catch (transErr) {
                    console.error('Transcript Generation Error:', transErr);
                }

                setTimeout(async () => {
                    try {
                        await interaction.channel.delete();
                    } catch (err) {
                        console.error('Failed to delete ticket channel:', err);
                    }
                }, 5000);
                return;
            }

            // Handle continue application button
            if (customId.startsWith('continue_application_')) {
                const language = customId.split('_')[2];
                const questions = getQuestions(language);

                // Get stored first part answers
                const tempData = interaction.client.tempApplications?.get(interaction.user.id);
                if (!tempData) {
                    await interaction.reply({
                        content: language === 'arabic' ? 'انتهت صلاحية الطلب. يرجى البدء من جديد.' :
                            language === 'english' ? 'Application expired. Please start over.' :
                                language === 'darija' ? 'الطلب خلص الوقت ديالو. ابدا من جديد.' :
                                    'Asuter yemmut. Ales seg tazwara.',
                        ephemeral: true
                    });
                    return;
                }

                // Create second modal with questions 6-10
                const secondModal = new ModalBuilder()
                    .setCustomId(`apply_modal_${language}_part2`)
                    .setTitle(getModalTitle(language) + ' (Part 2)');

                const components = [];
                for (let i = 5; i < Math.min(10, questions.length); i++) {
                    const textInput = new TextInputBuilder()
                        .setCustomId(`question_${i + 1}`)
                        .setLabel(questions[i].substring(0, 45))
                        .setPlaceholder(questions[i].substring(0, 100))
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(1000);

                    const actionRow = new ActionRowBuilder().addComponents(textInput);
                    components.push(actionRow);
                }

                secondModal.addComponents(...components);

                try {
                    await interaction.showModal(secondModal);
                } catch (error) {
                    console.error('Error showing second modal:', error);
                    await interaction.reply({
                        content: 'There was an error displaying the form. Please try again.',
                        ephemeral: true
                    });
                }
                return;
            }

            // Handle help menu interactions
            if (customId.startsWith('help_')) {
                await handleHelpInteraction(interaction);
                return;
            }

            // Handle poll button interactions
            if (customId.startsWith('poll_results_') || customId.startsWith('poll_end_')) {
                const messageId = customId.split('_')[2];
                const pollData = interaction.client.polls?.get(messageId);

                if (!pollData) {
                    return interaction.reply({ content: '❌ Poll data not found or poll has already ended.', ephemeral: true });
                }

                if (customId.startsWith('poll_results_')) {
                    // Show current results without ending the poll
                    showPollResults(interaction, pollData, messageId, false);
                } else if (customId.startsWith('poll_end_')) {
                    // Check if user is poll creator or has admin permissions
                    if (interaction.user.id !== pollData.creator && !interaction.member.permissions.has('Administrator')) {
                        return interaction.reply({ content: '❌ Only the poll creator or administrators can end this poll.', ephemeral: true });
                    }

                    // End the poll and show final results
                    endPollFromButton(interaction, pollData, messageId);
                }
            }

            // --- ASK ROLE SYSTEM: INITIALIZATION ---
            if (customId === 'ask_role_init') {
                const typeSelect = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('ask_role_type_select')
                        .setPlaceholder('Select Your Desired Permission Tier...')
                        .addOptions([
                            { label: 'Visual Alpha', description: 'Permission to send images & videos', value: 'Pic Perm', emoji: '🖼️' },
                            { label: 'Event Management', description: 'Permission to start community activities', value: 'Activities Perm', emoji: '🎮' },
                            { label: 'Voice Control', description: 'Permission to move members in voice', value: 'Move Perm', emoji: '🔊' },
                            { label: 'Moderation Lite', description: 'Permission to mute/unmute members', value: 'Mute Perm', emoji: '🔇' },
                            { label: 'External Links', description: 'Permission to share verified links', value: 'Link Perm', emoji: '🔗' }
                        ])
                );

                const initEmbed = new EmbedBuilder()
                    .setAuthor({ name: 'Wisdom Security Terminal', iconURL: interaction.guild.iconURL({ dynamic: true }) })
                    .setTitle('<a:diamonda:1360835764807536702> Identity & Permission Upgrade')
                    .setDescription(
                        '<a:waves:1360826963216044223> Welcome to the **Wisdom Permission Portal**.\n\n' +
                        '> Please select the **Access Tier** you wish to apply for. ' +
                        'Ensure you have a valid reason and are committed to maintaining server integrity.\n\n' +
                        '<a:notif:1447321335117123610> **Note:** Choose carefully based on your actual needs.'
                    )
                    .addFields({ name: '<a:gear:1447323688092438738> Protocol', value: 'Select a tier below to begin the classification process.' })
                    .setColor('#7289da')
                    .setThumbnail('https://i.postimg.cc/7ZTV4hfL/image.png')
                    .setImage('https://i.postimg.cc/mrvK4Kby/download-(4).jpg')
                    .setFooter({ text: 'Wisdom Team Infrastructure | Integrity is Mandatory', iconURL: interaction.client.user.displayAvatarURL() });

                await interaction.reply({ embeds: [initEmbed], components: [typeSelect], ephemeral: true });
                return;
            }

            // --- STATELESS ROLE SYSTEM: ADMIN ACTIONS ---
            if (customId.startsWith('role_st_acc_')) { // role_st_acc_[userId]_[roleType]
                const parts = customId.split('_');
                const targetUserId = parts[3];
                const roleType = parts.slice(4).join('_');
                const msgId = interaction.message.id; // Get the ID of the request message

                try {
                    const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => ({ username: 'Unknown User' }));

                    const roleSelect = new ActionRowBuilder().addComponents(
                        new RoleSelectMenuBuilder()
                            .setCustomId(`role_st_sel_${targetUserId}_${roleType}_${msgId}`)
                            .setPlaceholder('Select the role to grant to this applicant...')
                            .setMinValues(1)
                            .setMaxValues(1)
                    );

                    await interaction.reply({
                        content: `🛠️ **Stateless Auth:** Choose a role for **${targetUser.username}** applying for **${roleType}**:`,
                        components: [roleSelect],
                        ephemeral: true
                    });
                } catch (err) {
                    console.error('[Stateless Accept Error]:', err);
                    const errMsg = err.message || 'Unknown Error';
                    if (!interaction.replied) {
                        await interaction.reply({ content: `❌ **System Error:** ${errMsg}`, ephemeral: true }).catch(() => { });
                    }
                }
                return;
            }

            if (customId.startsWith('role_st_rej_')) {
                const parts = customId.split('_');
                const targetUserId = parts[3];
                const roleType = parts.slice(4).join('_');

                const modal = new ModalBuilder()
                    .setCustomId(`role_st_modrej_${targetUserId}_${roleType}`)
                    .setTitle('DENIAL PROTOCOL | بروتوكول الرفض');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('rejection_reason')
                    .setLabel('REASON FOR EVALUATION TERMINATION')
                    .setPlaceholder('Enter the justification for denial...')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
                await interaction.showModal(modal);
                return;
            }
        }

        // Handle modal submissions
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('apply_modal_')) {
                const language = interaction.customId.split('_')[2];
                const questions = getQuestions(language);

                // Check if this is part 2 submission
                if (interaction.customId.includes('_part2')) {
                    // Get stored first part answers
                    const tempData = interaction.client.tempApplications?.get(interaction.user.id);
                    if (!tempData) {
                        await interaction.reply({
                            content: 'Session expired. Please start over.',
                            ephemeral: true
                        });
                        return;
                    }

                    // Collect answers from questions 6-10
                    const secondAnswers = [];
                    for (let i = 6; i <= Math.min(10, questions.length); i++) {
                        const answer = interaction.fields.getTextInputValue(`question_${i}`);
                        secondAnswers.push(answer);
                    }

                    // Combine all answers
                    const allAnswers = [...tempData.answers, ...secondAnswers];

                    // Clean up temporary data
                    interaction.client.tempApplications.delete(interaction.user.id);

                    // Process complete application
                    await processApplication(interaction, language, allAnswers, questions);
                    return;
                }

                // Handle part 1 submission (first 5 questions)
                const answers = [];
                for (let i = 1; i <= 5; i++) {
                    const answer = interaction.fields.getTextInputValue(`question_${i}`);
                    answers.push(answer);
                }

                // If there are more than 5 questions, show button for next part
                if (questions.length > 5) {
                    // Store first part answers temporarily
                    interaction.client.tempApplications = interaction.client.tempApplications || new Map();
                    interaction.client.tempApplications.set(interaction.user.id, {
                        language,
                        answers,
                        timestamp: Date.now()
                    });

                    const continueButton = new ButtonBuilder()
                        .setCustomId(`continue_application_${language}`)
                        .setLabel('Continue to Next Questions')
                        .setStyle(ButtonStyle.Primary);

                    const row = new ActionRowBuilder().addComponents(continueButton);

                    const embed = new EmbedBuilder()
                        .setTitle('Part 1 Completed')
                        .setDescription('You have completed the first 5 questions. Click the button below to continue with the remaining questions.')
                        .setColor('#00ff00');

                    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
                    return;
                }

                // Process complete application (5 or fewer questions)
                await processApplication(interaction, language, answers, questions);
            }

            // Handle second part of modal
            if (interaction.customId.includes('_part2')) {
                const language = interaction.customId.split('_')[2];
                const questions = getQuestions(language);

                // Get stored first part answers
                const tempApp = interaction.client.tempApplications?.get(interaction.user.id);
                if (!tempApp) {
                    await interaction.reply({
                        content: language === 'arabic' ? 'انتهت صلاحية الجلسة. يرجى إعادة بدء الطلب.' :
                            language === 'english' ? 'Session expired. Please start the application again.' :
                                language === 'darija' ? 'سالي الوقت ديال السيشن. بدا الطلب من جديد.' :
                                    'ⵜⵓⵙⵙⵉ ⵜⵉⵡⵔⵉⵙⵜ. ⴰⴷ ⵜⵙⴱⵔⴷ ⵏ ⵜⵎⵎⵉⵔⵜ ⵏ ⵓⵙⵓⵜⵔ.',
                        ephemeral: true
                    });
                    return;
                }

                // Collect answers from second part
                const secondPartAnswers = [];
                for (let i = 6; i <= Math.min(10, questions.length); i++) {
                    const answer = interaction.fields.getTextInputValue(`question_${i}`);
                    secondPartAnswers.push(answer);
                }

                // Combine all answers
                const allAnswers = [...tempApp.answers, ...secondPartAnswers];

                // Clean up temporary storage
                interaction.client.tempApplications.delete(interaction.user.id);

                // Process complete application
                await processApplication(interaction, language, allAnswers, questions);
            }

            // --- STATELESS ASK ROLE MODAL SUBMISSION ---
            if (interaction.customId.startsWith('ask_role_modal_')) {
                const roleType = interaction.customId.replace('ask_role_modal_', '');
                const reason = interaction.fields.getTextInputValue('role_reason');
                const commitment = interaction.fields.getTextInputValue('role_commitment');

                try {
                    await interaction.reply({
                        content: '<a:tick:1367359515204391025> **تم إرسال طلبك بنجاح!** سيقوم فريق الإدارة بمراجعته والرد عليك قريباً.',
                        ephemeral: true
                    });

                    let targetId = process.env.role_request_id?.trim();
                    if (targetId && targetId.includes(',')) targetId = targetId.split(',')[0].trim();
                    let logsChannel = interaction.guild.channels.cache.get(targetId) || await interaction.guild.channels.fetch(targetId).catch(() => null);

                    if (!logsChannel) logsChannel = interaction.guild.channels.cache.find(c => c.name.includes('role-requests'));

                    if (logsChannel) {
                        const embed = new EmbedBuilder()
                            .setAuthor({ name: 'Security Registry: Access Application', iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                            .setTitle('<a:notif:1447321335117123610> New Permission Tier Request')
                            .setDescription(`A member has initiated the **Identity Upgrade Protocol**. Please evaluate the following dossier for approval or denial.`)
                            .addFields(
                                { name: '<:roles:1360453046470967407> Applicant Entity', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                                { name: '<a:diamonda:1360835764807536702> Requested Tier', value: `\`${roleType}\``, inline: true },
                                { name: '<a:info:1454901148547940442> Admission Reason', value: `> ${reason}`, inline: false },
                                { name: '<a:11pm_puffheart:1448728817207349430> Behavioral Commitment', value: `> ${commitment}`, inline: false }
                            )
                            .setColor('#e67e22') // Orange for pending
                            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                            .setFooter({ text: 'Wisdom Administrative Review Required', iconURL: interaction.client.user.displayAvatarURL() })
                            .setTimestamp();

                        const buttons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`role_st_acc_${interaction.user.id}_${roleType}`).setLabel('Grant Access - قبول').setStyle(ButtonStyle.Success).setEmoji('1367359515204391025'),
                            new ButtonBuilder().setCustomId(`role_st_rej_${interaction.user.id}_${roleType}`).setLabel('Deny Request - رفض').setStyle(ButtonStyle.Danger).setEmoji('1367359614458396764')
                        );

                        await logsChannel.send({ embeds: [embed], components: [buttons] });
                    }
                } catch (err) {
                    console.error('[AskRole] Error:', err);
                }
                return;
            }

            // --- STATELESS ROLE REJECT MODAL ---
            if (interaction.customId.startsWith('role_st_modrej_')) {
                const parts = interaction.customId.split('_');
                const targetUserId = parts[3];
                const roleType = parts.slice(4).join('_');
                const reason = interaction.fields.getTextInputValue('rejection_reason');

                try {
                    const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
                    if (targetUser) {
                        const dm = new EmbedBuilder()
                            .setAuthor({ name: 'Wisdom Security: Application Evaluation', iconURL: interaction.guild.iconURL({ dynamic: true }) })
                            .setTitle('<a:cross:1367359614458396764> Access Request Denied')
                            .setDescription(
                                `Greetings **${targetUser.username}**,\n\n` +
                                `Your application for the **${roleType}** access tier has been strictly evaluated and was **Rejected** by the administration.\n\n` +
                                `> **Reason:** ${reason}\n\n` +
                                `<a:warning_animated:1361729714259099809> *Repeated invalid applications may lead to temporary restriction.*`
                            )
                            .setColor('#ff4757')
                            .setImage('https://i.postimg.cc/q7BvnmW0/image.png')
                            .setFooter({ text: 'Wisdom Integrity Control Unit' });
                        await targetUser.send({ embeds: [dm] }).catch(() => { });
                    }

                    const update = EmbedBuilder.from(interaction.message.embeds[0])
                        .setTitle('<a:cross:1367359614458396764> Request Denied & Archive Closed')
                        .setColor('#ff4757')
                        .setDescription(`This evaluation has been finalized by **${interaction.user.tag}**.`)
                        .addFields(
                            { name: '<a:admin:1452014173075669012> Administrator', value: `${interaction.user}`, inline: true },
                            { name: '<a:info:1454901148547940442> Denial Reason', value: `\`${reason}\``, inline: true }
                        );

                    await interaction.message.edit({ embeds: [update], components: [] });
                    await interaction.reply({ content: '<a:tick:1367359515204391025> Rejection finalized.', ephemeral: true });
                } catch (e) {
                    console.error(e);
                }
                return;
            }

            // --- ROLE REJECT MODAL SUBMISSION ---
            if (interaction.customId.startsWith('role_reject_modal_')) {
                const requestId = interaction.customId.split('_')[3];
                const reason = interaction.fields.getTextInputValue('rejection_reason');
                try {
                    if (mongoose.connection.readyState !== 1) {
                        return interaction.reply({ content: '❌ **Database Offline:** Action aborted.', ephemeral: true });
                    }
                    const req = await RoleRequest.findById(requestId);

                    if (req) {
                        req.status = 'REJECTED';
                        req.rejectionReason = reason;
                        req.moderatorId = interaction.user.id;
                        req.moderatorTag = interaction.user.tag;
                        await req.save();

                        // DM User
                        const targetUser = await interaction.client.users.fetch(req.userId).catch(() => null);
                        if (targetUser) {
                            const dmEmbed = new EmbedBuilder()
                                .setAuthor({ name: 'Wisdom Security: Application Evaluation', iconURL: interaction.guild.iconURL({ dynamic: true }) })
                                .setTitle('<a:cross:1367359614458396764> Application Terminated')
                                .setDescription(
                                    `Greetings **${targetUser.username}**,\n\n` +
                                    `Your application for the **${req.roleType}** tier has been evaluated by the Council and was **Rejected**.\n\n` +
                                    `> **Evaluation Notes:** ${reason}\n\n` +
                                    `<a:warning_animated:1361729714259099809> *Integrity is mandatory. Please review our community standards.*`
                                )
                                .setColor('#ff4757')
                                .setThumbnail(interaction.guild.iconURL())
                                .setImage('https://i.postimg.cc/q7BvnmW0/image.png')
                                .setFooter({ text: 'Wisdom Community Integrity Protocol' });

                            await targetUser.send({ embeds: [dmEmbed] }).catch(() => { });
                        }

                        await interaction.reply({ content: '✅ **Status Updated:** Request has been denied and logged.', ephemeral: true });

                        // Update admin message
                        const updateEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                            .setTitle('🚫 Request Denied')
                            .setColor('#ff4757')
                            .setDescription(`This dossier has been closed by **${interaction.user.tag}**.`)
                            .addFields({ name: '📉 Denial Reason', value: `\`${reason}\`` })
                            .setFooter({ text: `Evaluated by ${interaction.user.tag}` });
                        await interaction.message.edit({ embeds: [updateEmbed], components: [] });
                    }
                } catch (err) {
                    console.error('Role Request Reject Error:', err);
                    await interaction.reply({ content: '❌ **Request Failed:** Could not process rejection.', ephemeral: true });
                }
            }
        }

        // Handle select menus (String, Role, etc.)
        if (interaction.isAnySelectMenu()) {
            if (interaction.customId === 'help_category_select') {
                await handleHelpCategorySelect(interaction);
                return;
            }

            // --- TICKET SYSTEM: TICKET CREATION ---
            if (interaction.customId === 'ticket_type_select') {
                const type = interaction.values[0];
                const guild = interaction.guild;
                const user = interaction.user;

                await interaction.deferReply({ ephemeral: true });

                try {
                    const ticketConfig = await Ticket.findOne({ guildId: guild.id });
                    if (!ticketConfig) {
                        return interaction.editReply({ content: '❌ **System Error:** Ticket configuration not found. Please contact an Administrator.' });
                    }

                    // Sanitize channel name using displayName (Replace spaces and special characters)
                    const displayName = interaction.member.displayName;
                    const sanitizedName = displayName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    const channelName = `${sanitizedName}-${type}`;

                    const ticketChannel = await guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        parent: ticketConfig.categoryId,
                        permissionOverwrites: [
                            {
                                id: guild.id,
                                deny: [PermissionFlagsBits.ViewChannel],
                            },
                            {
                                id: user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.AttachFiles,
                                    PermissionFlagsBits.EmbedLinks,
                                    PermissionFlagsBits.ReadMessageHistory
                                ],
                            },
                            {
                                id: guild.members.me.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                            }
                        ],
                    });

                    const ticketEmbed = new EmbedBuilder()
                        .setAuthor({ name: `Personal Terminal: ${type.toUpperCase()}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
                        .setTitle('<a:notif:1447321335117123610> Operational Synchronization')
                        .setDescription(
                            `<a:waves:1360826963216044223> Greetings **${displayName}**,\n` +
                            `Your secure session is now active. Please describe your inquiry below.\n\n` +
                            `<a:gear:1447323688092438738> **System Ready:** Staff notification dispatched.\n` +
                            `<a:11pm_puffheart:1448728817207349430> **سيقوم فريق الإدارة بمراجعة تذكرتك في أقرب وقت ممكن.**`
                        )
                        .setColor('#3498db')
                        .setThumbnail('https://i.postimg.cc/zv5D2hYn/Kawaii-Welcome.jpg')
                        .setFooter({ text: 'WISDOM TICKET PROTOCOL | SECURITY UNIT', iconURL: interaction.client.user.displayAvatarURL() })
                        .setTimestamp();

                    const closeButton = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_close')
                            .setLabel('Purge Session - إغلاق')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒')
                    );

                    await ticketChannel.send({
                        content: `${user} | <@&${interaction.guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.ManageChannels))?.id || ''}>`,
                        embeds: [ticketEmbed],
                        components: [closeButton]
                    });

                    await interaction.editReply({ content: `<a:tick:1367359515204391025> **Secure line established:** ${ticketChannel}` });

                } catch (error) {
                    console.error('Ticket Creation Error:', error);
                    await interaction.editReply({
                        content: `❌ **Protocol Error:** Initialization failed.\n⚠️ **Exact Reason:** \`${error.message}\``
                    });
                }
                return;
            }

            // --- ASK ROLE SYSTEM: TYPE SELECTION ---
            if (interaction.customId === 'ask_role_type_select') {
                const roleType = interaction.values[0];

                const modal = new ModalBuilder()
                    .setCustomId(`ask_role_modal_${roleType}`)
                    .setTitle(`UPGRADE DOSSIER: ${roleType}`);

                const reasonInput = new TextInputBuilder()
                    .setCustomId('role_reason')
                    .setLabel('JUSTIFICATION & INTENT')
                    .setPlaceholder('Why do you require this specific access tier?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const commitmentInput = new TextInputBuilder()
                    .setCustomId('role_commitment')
                    .setLabel('PROTOCOL COMMITMENT')
                    .setPlaceholder('Do you agree to maintain community integrity?')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(reasonInput),
                    new ActionRowBuilder().addComponents(commitmentInput)
                );

                await interaction.showModal(modal);
                return;
            }

            // --- STATELESS ROLE SELECT (RoleSelectMenu) ---
            if (interaction.customId.startsWith('role_st_sel_')) {
                const parts = interaction.customId.split('_'); // role_st_sel_[userId]_[roleType]_[msgId]
                const targetUserId = parts[3];
                const msgId = parts[parts.length - 1];
                const roleType = parts.slice(4, -1).join('_');
                const roleId = interaction.values[0];

                try {
                    const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
                    const role = interaction.guild.roles.cache.get(roleId) || await interaction.guild.roles.fetch(roleId).catch(() => null);

                    if (!member) return interaction.reply({ content: '❌ **Error:** User not found in server.', ephemeral: true });
                    if (!role) return interaction.reply({ content: '❌ **Error:** Selected role no longer exists.', ephemeral: true });

                    if (!role.editable) {
                        return interaction.reply({ content: `❌ **Permissions Error:** My role is below **${role.name}**. Move my role higher to manage it.`, ephemeral: true });
                    }

                    await member.roles.add(role);

                    const dm = new EmbedBuilder()
                        .setAuthor({ name: 'Wisdom Intelligence: Identity Authorized', iconURL: interaction.guild.iconURL({ dynamic: true }) })
                        .setTitle('<a:diamonda:1360835764807536702> Authorization Granted')
                        .setDescription(
                            `Greetings **${member.user.username}**,\n\n` +
                            `The **Wisdom Council** has authenticated your request. You have been granted the **${roleType}** privileges within our ecosystem.\n\n` +
                            '<a:11pm_puffheart:1448728817207349430> **لقد وضعنا ثقتنا فيكم، فكونوا أهلاً لها. استخدم صلاحياتك لتعزيز رقي المجتمع.**'
                        )
                        .addFields(
                            { name: '<:roles:1360453046470967407> Granted Tier', value: `\`${role.name}\``, inline: true },
                            { name: '<a:admin:1452014173075669012> Authorized By', value: `${interaction.user.tag}`, inline: true }
                        )
                        .setThumbnail('https://i.postimg.cc/zv5D2hYn/Kawaii-Welcome.jpg')
                        .setImage('https://i.postimg.cc/DzQw49Cy/Serenilly2t.gif')
                        .setColor('#2ecc71')
                        .setFooter({ text: 'Wisdom Community Integrity Protocol', iconURL: interaction.client.user.displayAvatarURL() });

                    await member.send({ embeds: [dm] }).catch(() => { });

                    // 1. Update the Ephemeral Menu Message
                    await interaction.update({ content: `✅ **Success:** ${member.user.tag} has been authorized for **${role.name}**.`, components: [] }).catch(() => { });

                    // 2. Update the Original Admin Request Message in Channel
                    try {
                        const originalMsg = await interaction.channel.messages.fetch(msgId).catch(() => null);
                        if (originalMsg && originalMsg.embeds.length > 0) {
                            const update = EmbedBuilder.from(originalMsg.embeds[0])
                                .setTitle('<a:tick:1367359515204391025> Application Finalized & Authorized')
                                .setColor('#2ecc71')
                                .setDescription(`The identity upgrade protocol for ${member.user} has been successfully completed and archived.`)
                                .addFields(
                                    { name: '<a:admin:1452014173075669012> Administrator', value: `${interaction.user}`, inline: true },
                                    { name: '<:roles:1360453046470967407> Assigned Role', value: `${role}`, inline: true }
                                )
                                .setFooter({ text: `Finalized by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                                .setTimestamp();

                            await originalMsg.edit({ embeds: [update], components: [] }).catch(() => { });
                        }
                    } catch (editErr) {
                        console.error('[Admin Msg Update Error]:', editErr.message);
                    }
                } catch (e) {
                    console.error('[Role Selection Error]:', e);
                    if (!interaction.replied) {
                        await interaction.reply({ content: `❌ **Failed to grant role:** ${e.message}`, ephemeral: true }).catch(() => { });
                    }
                }
                return;
            }
        }
    }
};

// Function to show poll results without ending
async function showPollResults(interaction, pollData, messageId, isEnding = false) {
    try {
        const message = await interaction.channel.messages.fetch(messageId);
        const reactions = message.reactions.cache;
        let totalVotes = 0;
        const results = [];

        if (pollData.options.length > 0) {
            // Custom options poll
            for (let i = 0; i < pollData.options.length; i++) {
                const reaction = reactions.get(pollData.numberEmojis[i]);
                const count = reaction ? reaction.count - 1 : 0; // Subtract bot's reaction
                results.push({ option: pollData.options[i], votes: count, emoji: pollData.numberEmojis[i] });
                totalVotes += count;
            }
        } else {
            // Yes/No poll
            const yesReaction = reactions.get('✅');
            const noReaction = reactions.get('❌');
            const yesVotes = yesReaction ? yesReaction.count - 1 : 0;
            const noVotes = noReaction ? noReaction.count - 1 : 0;

            results.push({ option: 'Yes', votes: yesVotes, emoji: '✅' });
            results.push({ option: 'No', votes: noVotes, emoji: '❌' });
            totalVotes = yesVotes + noVotes;
        }

        // Sort results by vote count
        results.sort((a, b) => b.votes - a.votes);

        let resultsText = '';
        if (totalVotes > 0) {
            results.forEach((result, index) => {
                const percentage = ((result.votes / totalVotes) * 100).toFixed(1);
                const barLength = Math.round((result.votes / Math.max(...results.map(r => r.votes))) * 10);
                const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);

                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
                resultsText += `${medal} ${result.emoji} **${result.option}**\n`;
                resultsText += `${bar} ${result.votes} votes (${percentage}%)\n\n`;
            });
        } else {
            resultsText = 'No votes have been cast yet.';
        }

        const embed = {
            title: isEnding ? '📊 Final Poll Results' : '📊 Current Poll Results',
            description: `**${pollData.question}**`,
            color: isEnding ? 0x00ff00 : 0x4834d4,
            fields: [
                {
                    name: '📈 Results',
                    value: resultsText,
                    inline: false
                }
            ],
            footer: {
                text: 'Jebrila System | By APOllO ❤ V69©'
            },
            timestamp: new Date().toISOString()
        };

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
        console.error('Error showing poll results:', error);
        await interaction.reply({ content: '❌ An error occurred while fetching poll results.', ephemeral: true });
    }
}

// Function to end poll from button interaction
async function endPollFromButton(interaction, pollData, messageId) {
    try {
        const message = await interaction.channel.messages.fetch(messageId);
        const reactions = message.reactions.cache;
        let totalVotes = 0;
        const results = [];

        if (pollData.options.length > 0) {
            // Custom options poll
            for (let i = 0; i < pollData.options.length; i++) {
                const reaction = reactions.get(pollData.numberEmojis[i]);
                const count = reaction ? reaction.count - 1 : 0; // Subtract bot's reaction
                results.push({ option: pollData.options[i], votes: count, emoji: pollData.numberEmojis[i] });
                totalVotes += count;
            }
        } else {
            // Yes/No poll
            const yesReaction = reactions.get('✅');
            const noReaction = reactions.get('❌');
            const yesVotes = yesReaction ? yesReaction.count - 1 : 0;
            const noVotes = noReaction ? noReaction.count - 1 : 0;

            results.push({ option: 'Yes', votes: yesVotes, emoji: '✅' });
            results.push({ option: 'No', votes: noVotes, emoji: '❌' });
            totalVotes = yesVotes + noVotes;
        }

        // Sort results by vote count
        results.sort((a, b) => b.votes - a.votes);

        // Create final results embed
        const creator = await interaction.client.users.fetch(pollData.creator);

        const resultsEmbed = new EmbedBuilder()
            .setTitle('📊 Poll Results')
            .setDescription(`**${pollData.question}**`)
            .setColor('#00ff00')
            .setAuthor({
                name: pollData.isAnonymous ? 'Anonymous Poll' : creator.tag,
                iconURL: pollData.isAnonymous ? interaction.guild.iconURL({ dynamic: true }) : creator.displayAvatarURL({ dynamic: true })
            })
            .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
            .setTimestamp();

        if (totalVotes > 0) {
            let resultsText = '';
            results.forEach((result, index) => {
                const percentage = ((result.votes / totalVotes) * 100).toFixed(1);
                const barLength = Math.round((result.votes / Math.max(...results.map(r => r.votes))) * 10);
                const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);

                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
                resultsText += `${medal} ${result.emoji} **${result.option}**\n`;
                resultsText += `${bar} ${result.votes} votes (${percentage}%)\n\n`;
            });

            resultsEmbed.addFields({ name: '📈 Results', value: resultsText, inline: false });
        } else {
            resultsEmbed.addFields({ name: '📈 Results', value: 'No votes were cast.', inline: false });
        }

        // Update the message with results and remove components
        await message.edit({ embeds: [resultsEmbed], components: [] });

        // Remove poll data from memory
        if (interaction.client.polls) {
            interaction.client.polls.delete(messageId);
        }

        await interaction.reply({ content: '✅ Poll has been ended successfully!', ephemeral: true });

    } catch (error) {
        console.error('Error ending poll:', error);
        await interaction.reply({ content: '❌ An error occurred while ending the poll.', ephemeral: true });
    }
}

// Staff Application Helper Functions
function getModalTitle(language) {
    switch (language) {
        case 'arabic':
            return 'طلب انضمام للطاقم';
        case 'english':
            return 'Staff Application';
        case 'darija':
            return 'طلب باش تولي ستاف';
        case 'tamazight':
            return 'ⴰⵙⵓⵜⵔ ⵏ ⵓⵙⴽⵛⵎ ⵉ staff';
        default:
            return 'Staff Application';
    }
}

function getQuestions(language) {
    switch (language) {
        case 'arabic':
            return [
                'ما هو اسمك على ديسكورد (Username + Tag)؟',
                'كم عمرك؟',
                'من أي بلد أنت؟',
                'كم من الوقت تقضي على ديسكورد يوميًا؟',
                'هل سبق وتم طردك أو حظرك من أي سيرفر؟ إذا نعم، لماذا؟',
                'هل سبق وبلغ عنك أحد بسبب إساءة أو مخالفة؟',
                'ما هي المدة التي تتوقع البقاء فيها كستاف إذا تم قبولك؟',
                'هل تستطيع الالتزام بالرد على الرسائل أو البلاغات في وقت قصير؟',
                'هل لديك أصدقاء أو معارف في السيرفر حاليًا؟',
                'إذا تم منحك الصلاحيات، هل توافق على أنه سيتم سحبها فورًا إذا فقدنا الثقة بك بدون نقاش؟'
            ];
        case 'english':
            return [
                'What is your Discord username (Username + Tag)?',
                'How old are you?',
                'Which country are you from?',
                'How many hours per day do you spend on Discord?',
                'Have you ever been kicked or banned from any server? If yes, why?',
                'Has anyone ever reported you for misconduct or rule-breaking?',
                'How long do you plan to stay as a staff member if accepted?',
                'Can you commit to responding to messages or reports quickly?',
                'Do you currently have any friends or acquaintances in this server?',
                'If given staff permissions, do you agree that they can be removed at any time if we lose trust in you, without discussion?'
            ];
        case 'darija':
            return [
                'شنو هو الاسم ديالك فديسكورد (Username + Tag)؟',
                'شحال فعمرك؟',
                'منين نتا؟',
                'شحال من الوقت كتقضي فديسكورد كل نهار؟',
                'واش سبق وطردوك ولا حظروك من شي سيرفر؟ إيلا آه، علاش؟',
                'واش سبق وشي واحد بلغ عليك حيت دريتي شي حاجة خايبة؟',
                'شحال من الوقت كتخطط تبقا ستاف إيلا قبلوك؟',
                'واش تقدر تلتزم باش ترد على الرسائل والبلاغات بزربة؟',
                'واش عندك شي صحاب ولا ناس تعرفهم فهاد السيرفر دابا؟',
                'إيلا عطاوك صلاحيات الستاف، واش موافق أنهم يقدرو يحيدوها منك أي وقت إيلا خسرو الثقة فيك، بلا نقاش؟'
            ];
        case 'tamazight':
            return [
                'ⵎⴰ ⵉⵙⵎⵉⵇ ⵉⴽ ⵖⴼ Discord (Username + Tag) ?',
                'ⵜⵣⵔⵉⵖ ⵎⴰⵛⵛⵉ ⵜⴰⵣⵡⴰⵔⵜⵉⴽ ?',
                'ⵙ ⴰⵎⴰⵏⵉ ⵜⵜⴷⴷⵓⴷ ?',
                'ⵙ ⴰⵛⵎⵉ ⵢⵉⴷⵔⴰⵏ ⵜⴻⵙⵙⴰⴷⴷ ⴷ ⵖⴼ Discord ⴷⴳ ⵡⴰⵙ ?',
                'ⵉⴹⴻⵍⵍⵉ ⵢⴻⵍⵍⴰ ⵢⵉⵡⴻⵏ ⵢⴻⵜⵜⴰⴹⴰⵔⴽ ⵏⴻⵏⵖ ⵢⴻⵃⴻⴹⴽ ⵙⴻⴳ ⵢⵉⵙⴻⵎ ⵏ ⵉⵡⴻⵔⵎⴰⴹ ? ⵎⴰ ⵉⵀ, ⵎⴻⵍ ⴷ ⴰⵢⵖⴻⵔ.',
                'ⵢⴻⵍⵍⴰ ⵢⵉⵡⴻⵏ ⵢⴻⵔⵏⴰ ⵉⵃⴻⴹ ⴼⴻⵍⵍⴰⴽ ⵉ ⵜⵖⴰⵔⴰ ⵏ ⵉⵜⵓⵇⵇⵏⴰ ⴻⵏⵖ ⵉ ⵜⵓⵇⵇⵏⴰ ⵏ ⴰⵚⴻⵔⴽⴰⵏ ?',
                'ⵎⴰⵟⵟⵉ ⴰⵔⴰ ⵜⴰⵣⵡⴰⵔⵜⵉⴽ ⵉ ⵜⴻⴱⵖⵉⴷ ⴰⴷ ⵜⴻⵇⵇⵉⵎⴷ ⴷ staff ⵎⴰ ⵜⵜⵡⴰⵇⴱⴻⵍⵉⴽ ?',
                'ⵜⵣⴻⵎⵔⴻⴷ ⴰⴷ ⵜⴻⵔⵔ ⴷ ⵜⵉⵔⵉⵔⵉⵜ ⵖⴻⵔ ⵢⴻⵣⵏⴰⵏ ⴻⵏⵖ ⵜⵉⵍⵖⴰⵔⵉⵏ ⵙ ⵣⵣⵎⴰⵏ ?',
                'ⵜⴻⵍⵍⴰⴽ ⵜⵓⵔⴰ ⴷ ⵉⵎⴻⵜⵜⵉ ⵏⴻⵏⵖ ⵉⵡⴻⵏⵏⵉⵜ ⵉ ⵜⵙⵙⴻⵏⴻⴷ ⴷⴳ ⵢⵉⵙⴻⵎ ⴰⴳⵉ ?',
                'ⵎⴰ ⵜⵜⵡⴰⴼⴽⴻⴷ ⵉ ⵢⵉⵣⴻⵔⴼⴰⵏ ⵏ staff, ⵜⵇⵇⵉⵎⴻⴷ ⵉ ⵜⵜⵉⵖⴻⵔ ⴰⴷ ⵜⵜⵟⵟⴻⵃⴻⴹ ⴷ ⵉⵎⴰⵏⵏ ⵎⴰ ⵢⴻⵜⵜⵡⴰⵃⴻⵔ ⵙ ⵓⵎⴰⵢⵏ ⵖⴻⴼⴽ, ⵡⴰⵔ ⴰⵡⴰⵍ ?'
            ];
        default:
            return [];
    }
}

async function processApplication(interaction, language, answers, questions) {
    try {
        // Create application embed
        const applicationEmbed = new EmbedBuilder()
            .setTitle('📋 New Staff Application')
            .setDescription(`**Applicant:** ${interaction.user} (${interaction.user.tag})\n**Language:** ${getLanguageDisplay(language)}\n**Applied:** <t:${Math.floor(Date.now() / 1000)}:F>`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setColor('#FFD700')
            .setFooter({ text: `User ID: ${interaction.user.id}` })
            .setTimestamp();

        // Add questions and answers as fields
        for (let i = 0; i < Math.min(questions.length, answers.length); i++) {
            const question = questions[i].length > 256 ? questions[i].substring(0, 253) + '...' : questions[i];
            const answer = answers[i].length > 1024 ? answers[i].substring(0, 1021) + '...' : answers[i];

            applicationEmbed.addFields({
                name: `${i + 1}. ${question}`,
                value: answer,
                inline: false
            });
        }

        // Send to submission channel
        const submissionChannel = interaction.client.channels.cache.get('1409971599377039370');
        if (submissionChannel) {
            await submissionChannel.send({ embeds: [applicationEmbed] });
        }

        // Send confirmation to user
        const confirmationMessage = getConfirmationMessage(language);
        try {
            await interaction.reply({
                content: confirmationMessage,
                ephemeral: true
            });
        } catch (replyError) {
            // Handle expired interaction gracefully
            if (replyError.code === 10062) {
                console.log('Interaction expired - application was processed successfully but user notification failed');
            } else {
                console.error('Error sending confirmation:', replyError);
            }
        }

    } catch (error) {
        console.error('Error processing application:', error);

        // Handle expired interaction (Unknown interaction error)
        if (error.code === 10062) {
            console.log('Interaction expired - application was processed but user notification failed');
            return; // Don't try to reply to expired interaction
        }

        try {
            await interaction.reply({
                content: 'There was an error processing your application. Please try again later.',
                ephemeral: true
            });
        } catch (replyError) {
            console.error('Failed to send error reply:', replyError);
        }
    }
}

function getLanguageDisplay(language) {
    switch (language) {
        case 'arabic':
            return '🇸🇦 العربية';
        case 'english':
            return '🇺🇸 English';
        case 'darija':
            return '🇲🇦 الدارجة المغربية';
        case 'tamazight':
            return '<:tamazight:1328392111963504771> ⵜⴰⵎⴰⵣⵉⵖⵜ';
        default:
            return 'Unknown';
    }
}

function getConfirmationMessage(language) {
    switch (language) {
        case 'arabic':
            return '✅ **تم إرسال طلبك بنجاح!**\n\nشكرًا لك على التقديم لفريق الطاقم. تم إرسال إجاباتك إلى الإدارة وسيتم مراجعتها قريبًا.\n\n**ماذا بعد؟**\n• انتظر الرد من الإدارة\n• ستحصل على الموافقة أو الرفض عبر الرسائل الخاصة\n• يرجى التحلي بالصبر أثناء عملية المراجعة\n\nحظًا موفقًا! 🍀';
        case 'english':
            return '✅ **Your application has been sent successfully!**\n\nThank you for applying to our staff team. Your answers have been submitted to the administration and will be reviewed soon.\n\n**What\'s next?**\n• Wait for a response from the administration\n• You will receive approval or decline via DM\n• Please be patient during the review process\n\nGood luck! 🍀';
        case 'darija':
            return '✅ **تم إرسال الطلب ديالك بنجاح!**\n\nشكرا ليك على التقديم لفريق الستاف. الأجوبة ديالك تبعثو للإدارة وغادي يراجعوها قريب.\n\n**شنو غادي يوقع دابا؟**\n• تسنا الجواب من الإدارة\n• غادي توصلك الموافقة ولا الرفض فالرسائل الخاصة\n• خاصك تصبر شوية باش يراجعو الطلب\n\nبالتوفيق! 🍀';
        case 'tamazight':
            return '✅ **ⴰⵙⵓⵜⵔ ⵏⵏⴽ ⵢⵓⵣⴰⵏ ⵙ ⵜⵎⴰⵎⴽⵜ!**\n\nⵜⴰⵏⵎⵎⵉⵔⵜ ⵅⴼ ⵓⵙⵓⵜⵔ ⵏ ⵓⵙⵔⴰⴳ. ⵜⵉⵔⴰⵔⵉⵏ ⵏⵏⴽ ⵜⵜⵓⵣⴰⵏⵉⵏ ⵉ ⵓⵙⵇⵇⵉⵎ ⴰⴷ ⵜⵏ ⵉⵙⵙⴽⵔ.\n\n**ⵎⴰⵏ ⴰⴷ ⵉⵍⵉⵏ?**\n• ⵔⴰⵊⵓ ⵜⵉⵔⴰⵔⵉⵏ ⵙⴳ ⵓⵙⵇⵇⵉⵎ\n• ⴰⴷ ⵜⴰⵡⵉⴷ ⴰⵇⴱⵓⵍ ⵏⵖ ⴰⴳⵢ ⵙ ⵜⵉⵔⴰⵔⵉⵏ ⵜⵓⵙⵙⵉⵏⵉⵏ\n• ⵉⵅⵚⵚⴰ ⴰⴷ ⵜⵙⴱⵔⴷ ⴰⵔ ⴰⴷ ⵜⵏ ⵉⵙⵙⴽⵔ\n\nⵙ ⵜⴼⵍⵓⴽⵜ! 🍀';
        default:
            return '✅ **Your application has been sent successfully!**\n\nThank you for applying to our staff team. Your answers have been submitted to the administration and will be reviewed soon.';
    }
}

// Help menu interaction handlers
async function handleHelpInteraction(interaction) {
    const { customId } = interaction;

    if (customId === 'help_refresh') {
        // Refresh the main menu
        const mainEmbed = createMainHelpEmbed(interaction);
        const components = createHelpComponents();

        await interaction.update({
            embeds: [mainEmbed],
            components: components
        });
        return;
    }

    if (customId === 'help_all_commands') {
        const allCommandsEmbed = createAllCommandsEmbed();
        await interaction.reply({ embeds: [allCommandsEmbed], ephemeral: true });
        return;
    }

    // Handle category buttons
    const category = customId.replace('help_', '');
    const categoryEmbed = createCategoryEmbed(category);
    await interaction.reply({ embeds: [categoryEmbed], ephemeral: true });
}

async function handleHelpCategorySelect(interaction) {
    const selectedCategory = interaction.values[0];
    const categoryEmbed = createCategoryEmbed(selectedCategory);
    await interaction.reply({ embeds: [categoryEmbed], ephemeral: true });
}

function createMainHelpEmbed(interaction) {
    return new EmbedBuilder()
        .setAuthor({
            name: `Wisdom Circle | Command Registry`,
            iconURL: interaction.client.user.displayAvatarURL()
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
        .setImage('https://i.postimg.cc/zv5D2hYn/Kawaii-Welcome.jpg')
        .setColor('#2b2d31')
        .setFooter({
            text: 'Jebrila Intelligence System | Authorization Required',
            iconURL: interaction.guild.iconURL({ dynamic: true })
        })
        .setTimestamp();
}

function createHelpComponents() {

    const categorySelect = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('📂 Browse specialized command modules...')
        .addOptions([
            { label: 'Security & Moderation', description: 'Enforcement protocols, bans, and kicks.', value: 'moderation', emoji: '🛡️' },
            { label: 'Administration Tools', description: 'Server configuration and channel control.', value: 'management', emoji: '⚙️' },
            { label: 'Intelligence Archive', description: 'User data, server stats, and registries.', value: 'information', emoji: '📂' },
            { label: 'Voice Core', description: 'Advanced voice channel manipulation.', value: 'voice', emoji: '🔊' },
            { label: 'Social & Birthdays', description: 'Community events and celebrations.', value: 'birthday', emoji: '🎉' },
            { label: 'Reporting Analytics', description: 'Incident reporting and status tracking.', value: 'report', emoji: '📝' },
            { label: 'Advanced Modules', description: 'Specialized system utilities.', value: 'special', emoji: '💎' }
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
    return [selectRow, quickButtons, navButtons];
}

function createCategoryEmbed(category) {
    const commandData = {
        moderation: {
            title: '🛡️ Security & Moderation Protocols',
            description: 'Advanced tools designed for community safety and disciplinary enforcement.',
            color: '#ff4757',
            commands: [
                { name: '!ban', description: 'Permanently remove an entity from the server.', usage: '!ban @user [reason]', permissions: 'Ban Members' },
                { name: '!unban', description: 'Revoke an existing ban using User ID.', usage: '!unban [ID]', permissions: 'Ban Members' },
                { name: '!kick', description: 'Forcefully disconnect an entity from the server.', usage: '!kick @user [reason]', permissions: 'Kick Members' },
                { name: '!mute / !unmute', description: 'Restrict or restore voice communication.', usage: '!mute @user', permissions: 'Mute Members' },
                { name: '!muteall / !unmuteall', description: 'Global voice silence control.', usage: '!muteall', permissions: 'Mute Members' },
                { name: '!warn', description: 'Issue a formal disciplinary warning (Auto-kick at 3).', usage: '!warn @user [reason]', permissions: 'Moderate Members' },
                { name: '!removewarn', description: 'Purge disciplinary records for a user.', usage: '!removewarn @user', permissions: 'Manage Messages' },
                { name: '!timeout / !rtimeout', description: 'Temporarily isolate a user from interaction.', usage: '!timeout @user [duration]', permissions: 'Moderate Members' },
                { name: '!clear', description: 'Purge a specified volume of messages.', usage: '!clear [amount]', permissions: 'Manage Messages' }
            ]
        },
        management: {
            title: '⚙️ Administration & Infrastructure',
            description: 'Tools for configuring the server environment and managing core components.',
            color: '#2f3542',
            commands: [
                { name: '!lock / !unlock', description: 'Global channel access control.', usage: '!lock [#channel]', permissions: 'Manage Channels' },
                { name: '!slowmode', description: 'Regulate message frequency in a channel.', usage: '!slowmode [seconds]', permissions: 'Manage Channels' },
                { name: '!role', description: 'Administrative role assignment.', usage: '!role @user [role]', permissions: 'Manage Roles' },
                { name: '!nickname', description: 'Modify identity aliases.', usage: '!nickname @user [name]', permissions: 'Manage Nicknames' },
                { name: '!nuke', description: 'Re-initialize a channel (Delete & Clone).', usage: '!nuke', permissions: 'Manage Channels' },
                { name: '!announce', description: 'Broadcast a stylized announcement.', usage: '!announce [#channel] [text]', permissions: 'Administrator' },
                { name: '!say', description: 'Communicate through the bot interface.', usage: '!say [message]', permissions: 'Manage Messages' }
            ]
        },
        information: {
            title: '📂 Intelligence Archive',
            description: 'Comprehensive data retrieval and server-wide identity analysis.',
            color: '#70a1ff',
            commands: [
                { name: '!userinfo / !whois', description: 'Full identity and diagnostic report.', usage: '!userinfo @user', permissions: 'None' },
                { name: '!server', description: 'Global server statistics and metadata.', usage: '!server', permissions: 'None' },
                { name: '!admins', description: 'List all authorized administrative entities.', usage: '!admins', permissions: 'None' },
                { name: '!rejectlist', description: 'View the restricted entrance registry.', usage: '!rejectlist', permissions: 'Manage Roles' },
                { name: '!showwarnings', description: 'Access user disciplinary records.', usage: '!showwarnings @user', permissions: 'Moderate Members' },
                { name: '!ping', description: 'Check system latency and heartbeat.', usage: '!ping', permissions: 'None' },
                { name: '!avatar / !banner', description: 'Retrieve user visual assets.', usage: '!avatar @user', permissions: 'None' }
            ]
        },
        voice: {
            title: '🔊 Voice Control Systems',
            description: 'Advanced manipulation of audio channels and user voice states.',
            color: '#a29bfe',
            commands: [
                { name: '!move / !moveall', description: 'Reposition users between audio nodes.', usage: '!move @user [channel]', permissions: 'Move Members' },
                { name: '!disconnect / !disconnectall', description: 'Terminate voice sessions.', usage: '!disconnect @user', permissions: 'Move Members' },
                { name: '!tsara', description: 'Voice presence detection protocol.', usage: '!tsara @user', permissions: 'None' },
                { name: '!whoisvoice', description: 'Deep scan of voice channel occupancy.', usage: '!whoisvoice', permissions: 'None' },
                { name: '!deafen / !undeafen', description: 'Manage audio reception states.', usage: '!deafen @user', permissions: 'Deafen Members' }
            ]
        },
        birthday: {
            title: '🎉 Community Events (Birthdays)',
            description: 'Social synchronization and automated celebration features.',
            color: '#feca57',
            commands: [
                { name: '!addbirthday', description: 'Register your emergence date.', usage: '!addbirthday [DD/MM]', permissions: 'None' },
                { name: '!birthdays', description: 'View the community celestial registry.', usage: '!birthdays', permissions: 'None' },
                { name: '!removebirthday', description: 'Delete personal celebration data.', usage: '!removebirthday', permissions: 'None' },
                { name: '!setupbirthdays', description: 'Configure birthday announcement nodes.', usage: '!setupbirthdays', permissions: 'Administrator' }
            ]
        },
        report: {
            title: '📝 Incident Analytics (Reports)',
            description: 'Registry for tracking community violations and reports.',
            color: '#ff6b6b',
            commands: [
                { name: '!report', description: 'File an official misconduct report.', usage: '!report @user [reason]', permissions: 'None' },
                { name: '!reportlist', description: 'Analyze pending incident reports.', usage: '!reportlist', permissions: 'Moderate Members' },
                { name: '!reportclean', description: 'Purge resolved incident logs.', usage: '!reportclean', permissions: 'Administrator' }
            ]
        },
        special: {
            title: '💎 Advanced System Modules',
            description: 'Specialized utilities and advanced server features.',
            color: '#1dd1a1',
            commands: [
                { name: '!reject / !unreject', description: 'Manage restricted server entrance.', usage: '!reject @user [reason]', permissions: 'Administrator' },
                { name: '!tracktimer', description: 'High-precision activity monitoring.', usage: '!tracktimer', permissions: 'None' },
                { name: '!giveaway', description: 'Initialize a reward distribution event.', usage: '!giveaway', permissions: 'Manage Messages' },
                { name: '!poll', description: 'Aggregate community consensus.', usage: '!poll', permissions: 'None' },
                { name: '!ja / !setupja', description: 'Manage community "Ja" protocols.', usage: '!ja @user', permissions: 'Administrator' },
                { name: '!zaboniya / !zaboniyalist', description: 'Disciplinary "Zaboniya" registry.', usage: '!zaboniya @user', permissions: 'Administrator' },
                { name: '!lmohim', description: 'Retrieve priority community data.', usage: '!lmohim', permissions: 'None' }
            ]
        }
    };

    const data = commandData[category];
    if (!data) return new EmbedBuilder().setTitle('❌ Error').setDescription('Category protocol not found.').setColor('#ff4757');

    const embed = new EmbedBuilder()
        .setAuthor({ name: `Module: ${data.title}`, iconURL: 'https://i.postimg.cc/26W3Kmqc/Goodbye.jpg' })
        .setTitle(`<:admin:1452014173075669012> ${data.title}`)
        .setDescription(`> *${data.description}*`)
        .setColor(data.color)
        .setTimestamp()
        .setThumbnail('https://i.postimg.cc/zv5D2hYn/Kawaii-Welcome.jpg')
        .setFooter({ text: 'Jebrila Intelligence System | Registry V3', iconURL: 'https://i.postimg.cc/zv5D2hYn/Kawaii-Welcome.jpg' });

    data.commands.forEach(cmd => {
        embed.addFields({
            name: `🔹 ${cmd.name}`,
            value: `> **Info:** ${cmd.description}\n> **Use:** \`${cmd.usage}\`\n> **Auth:** \`${cmd.permissions}\``,
            inline: false
        });
    });

    return embed;
}

function createAllCommandsEmbed() {
    return new EmbedBuilder()
        .setAuthor({ name: 'Jebrila System | Global Index', iconURL: 'https://i.postimg.cc/zv5D2hYn/Kawaii-Welcome.jpg' })
        .setTitle('📖 Full Intelligence Reference')
        .setDescription('Complete command manifest for the **Wisdom Circle** environment.')
        .setColor('#2b2d31')
        .addFields(
            { name: '🛡️ Security', value: '`ban` `kick` `mute` `unmute` `warn` `timeout` `unban` `clear`', inline: true },
            { name: '⚙️ Admin', value: '`lock` `unlock` `slowmode` `role` `nickname` `nuke` `setup`', inline: true },
            { name: '📂 Intel', value: '`userinfo` `server` `admins` `rejectlist` `showwarnings` `ping`', inline: true },
            { name: '🔊 Voice', value: '`move` `disconnect` `tsara` `whoisvoice` `muteall`', inline: true },
            { name: '🎉 Social', value: '`addbirthday` `birthdays` `removebirthday` `poll`', inline: true },
            { name: '📝 Report', value: '`report` `reportlist` `reportclean` `tracktimer`', inline: true },
            { name: '💎 Special', value: '`reject` `unreject` `giveaway` `zaboniya` `ja` `lmohim`', inline: true }
        )
        .setImage('https://i.postimg.cc/zv5D2hYn/Kawaii-Welcome.jpg')
        .setFooter({ text: 'Use categories for detailed usage instructions.' })
        .setTimestamp();
}

