const { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Import welcome settings utility
const welcomeCommand = require('../commands/welcome.js');

// ═══════════════════════════════════════════════════════════════════════════════
//                              UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates a visual progress bar for membership position
 * @param {number} position - Current member position
 * @param {number} total - Total members
 * @returns {string} Progress bar string
 */
function createMembershipProgress(position, total) {
    const percentage = Math.round((position / total) * 100);
    const filledBars = Math.round(percentage / 10);
    const emptyBars = 10 - filledBars;

    const progressBar = '🟩'.repeat(filledBars) + '⬜'.repeat(emptyBars);
    return `${progressBar} ${percentage}%`;
}

/**
 * Creates a welcome banner URL (placeholder for now)
 * @param {GuildMember} member - The new member
 * @param {number} position - Member join position
 * @returns {string|null} Banner URL or null
 */
function createWelcomeBanner(member, position) {
    // For now, return null - can be enhanced later with actual banner generation
    return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//                           GUILD MEMBER ADD EVENT
// ═══════════════════════════════════════════════════════════════════════════════
// This event handles new member joins with advanced features:
// • Welcome DM with server information
// • Public welcome message in designated channel
// • Auto-role assignment
// • Member count updates
// • Server statistics tracking
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        try {
            // ═══════════════════════════════════════════════════════════════════════
            //                          INVITE TRACKING SYSTEM
            // ═══════════════════════════════════════════════════════════════════════
            const fs = require('fs');
            const invitesPath = path.join(__dirname, '..', 'data', 'invites.json');
            let inviterData = {};
            try {
                if (fs.existsSync(invitesPath)) {
                    inviterData = JSON.parse(fs.readFileSync(invitesPath, 'utf8'));
                }
            } catch (err) { console.error('Error loading invites data:', err); }

            let inviter = null;
            let usedInviteCode = null;

            if (member.client.invites && member.guild.members.me.permissions.has('ManageGuild')) {
                try {
                    // Small delay to ensure invite uses are updated by Discord
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const newInvites = await member.guild.invites.fetch();
                    const oldInvites = member.client.invites.get(member.guild.id);

                    // Find which invite's use count increased
                    const invite = newInvites.find(i => {
                        const prevUses = oldInvites ? (oldInvites.get(i.code) || 0) : 0;
                        return i.uses > prevUses;
                    });

                    if (invite) {
                        inviter = invite.inviter;
                        usedInviteCode = invite.code;
                        console.log(`[Invites] Match found! ${member.user.tag} used ${invite.code} by ${inviter?.tag || 'Vanity'}`);
                    } else {
                        // Check for Vanity URL if applicable
                        if (member.guild.features.includes('VANITY_URL')) {
                            const vanity = await member.guild.fetchVanityData().catch(() => null);
                            if (vanity) {
                                // For vanity, we compare if the bot's cached vanity uses (if any) changed
                                // This is harder without explicit tracking, so we label as Vanity
                                inviter = null;
                                usedInviteCode = 'Vanity';
                            }
                        }
                    }

                    if (inviter || usedInviteCode === 'Vanity') {
                        // Store the inviter for later (when they leave)
                        if (!inviterData[member.guild.id]) inviterData[member.guild.id] = {};
                        inviterData[member.guild.id][member.id] = {
                            inviterId: inviter ? inviter.id : 'Vanity',
                            inviterTag: inviter ? inviter.tag : 'Vanity URL',
                            code: usedInviteCode,
                            timestamp: Date.now()
                        };
                        fs.writeFileSync(invitesPath, JSON.stringify(inviterData, null, 2));
                    }

                    // Update cache for next join
                    member.client.invites.set(member.guild.id, new Map(newInvites.map(i => [i.code, i.uses])));
                } catch (err) { console.log(`[Invites] Tracking error: ${err.message}`); }
            }
            // Assign result to member for embed access
            member.inviter = inviter;
            member.inviteCode = usedInviteCode;


            // ═══════════════════════════════════════════════════════════════════════
            //                          BOT QUARANTINE SYSTEM
            // ═══════════════════════════════════════════════════════════════════════
            if (member.user.bot) {
                const ownerId = '1329180315314556951'; // Main Owner ID: APollo
                let entry;

                try {
                    // Fetch audit logs to see who added the bot
                    const auditLogs = await member.guild.fetchAuditLogs({
                        limit: 1,
                        type: 28 // MEMBER_BOT_ADD
                    });
                    entry = auditLogs.entries.first();
                } catch (error) {
                    console.error('Error fetching audit logs for bot add:', error);
                }

                // If we found who added the bot
                if (entry) {
                    const executor = entry.executor;

                    // If the person who added the bot is NOT the owner
                    if (executor.id !== ownerId) {
                        try {
                            // Kick the bot
                            await member.kick('Unauthorized Bot Addition - Anti-Nuke System');

                            // Define owner user object for DM
                            const ownerUser = await member.client.users.fetch(ownerId).catch(() => null);

                            // Notify Owner
                            if (ownerUser) {
                                const alertEmbed = new EmbedBuilder()
                                    .setTitle('🛡️ Security Alert: Unauthorized Bot Added')
                                    .setDescription(`**Warning!** An unauthorized bot was added to **${member.guild.name}**.`)
                                    .addFields(
                                        { name: '🤖 Bot Name', value: `${member.user.tag} (${member.id})`, inline: true },
                                        { name: '👤 Added By', value: `${executor.tag} (${executor.id})`, inline: true },
                                        { name: '🛡️ Action Taken', value: 'Bot has been kicked automatically.', inline: false }
                                    )
                                    .setColor('#ff0000')
                                    .setTimestamp();

                                await ownerUser.send({ embeds: [alertEmbed] });
                            }

                            // Notify the person who added the bot
                            const warningEmbed = new EmbedBuilder()
                                .setTitle('🚫 Unauthorized Bot Addition')
                                .setDescription(`You have added a bot **(${member.user.tag})** without permission.\n\nThe bot has been kicked. Please request permission from **APollO** before adding bots.`)
                                .setColor('#ff4757')
                                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                                .setTimestamp();

                            await executor.send({ embeds: [warningEmbed] }).catch(() => { });

                            console.log(`[Anti-Bot] Kicked unauthorized bot ${member.user.tag} added by ${executor.tag}`);
                            return; // Stop processing welcome message for kicked bot

                        } catch (kickError) {
                            console.error(`[Anti-Bot] Failed to kick bot ${member.user.tag}:`, kickError);
                        }
                    }
                }
            }

            // Check if welcome system is enabled for this guild
            if (!welcomeCommand.isWelcomeEnabled(member.guild.id)) {
                console.log(`⏸️ Welcome system disabled for ${member.guild.name} - skipping welcome messages`);
                return;
            }
            // ═══════════════════════════════════════════════════════════════════════
            //                          CONFIGURATION SECTION
            // ═══════════════════════════════════════════════════════════════════════
            const config = {
                welcomeChannelId: '1340816672751353917', // Replace with your welcome channel ID
                autoRoleId: null, // Replace with role ID for auto-assignment (null to disable)
                colors: {
                    welcome: '#00ff88',
                    public: '#ff6b6b',
                    error: '#ff4757'
                },
                channels: {
                    rules: 'https://discord.com/channels/1201626435958354021/1201647312842277046',
                    roles: 'https://discord.com/channels/1201626435958354021/1338316546023620619',
                    games: 'https://discord.com/channels/1201626435958354021/1450202120048476354',
                    about: 'https://discord.com/channels/1201626435958354021/1201631430615244880'
                }
            };

            // ═══════════════════════════════════════════════════════════════════════
            //                          MEMBER INFORMATION
            // ═══════════════════════════════════════════════════════════════════════
            const guild = member.guild;
            const memberCount = guild.memberCount;
            const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
            const joinPosition = memberCount;

            console.log(`🎉 New member joined: ${member.user.tag} (ID: ${member.id})`);
            console.log(`📊 Server now has ${memberCount} members`);

            // ═══════════════════════════════════════════════════════════════════════
            //                          ENHANCED WELCOME DM EMBED
            // ═══════════════════════════════════════════════════════════════════════
            const accountStatus = accountAge < 7 ? '🆕 New Account' :
                accountAge < 30 ? '📅 Recent Account' :
                    accountAge < 365 ? '✅ Established Account' : '🏅 Veteran Account';

            const welcomeDMEmbed = new EmbedBuilder()
                .setTitle(`🎉 Welcome to ${guild.name}!`)
                .setDescription(
                    `Hello **${member.user.username}**! <a:discord_bot:1454103318514110610>\n\n` +
                    `Welcome to our community of freethinkers and intellectual explorers. We're excited to have you here! <a:11pm_puffheart:1448728817207349430>\n\n` +
                    `**You are member #${joinPosition}** <a:asinexegiveweays:1361729576828407828>`
                )
                .addFields(
                    {
                        name: '📜 Important Links',
                        value: `[Community Rules](${config.channels.rules})\n[Get Roles](${config.channels.roles})\n[Gaming](${config.channels.games})\n[About Us](${config.channels.about})`,
                        inline: true
                    },
                    {
                        name: '📊 Your Profile',
                        value: `**Position:** #${joinPosition}\n**Account Age:** ${accountAge} days\n**Status:** ${accountStatus}`,
                        inline: true
                    }
                )
                .setColor('#2F3136')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setImage('https://i.postimg.cc/zv5D2hYn/Kawaii-Welcome.jpg')
                .setFooter({
                    text: 'Jebrila System | By APOllO ❤ V69©',
                    iconURL: guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            // ═══════════════════════════════════════════════════════════════════════
            //                          ENHANCED PUBLIC WELCOME EMBED
            // ═══════════════════════════════════════════════════════════════════════
            const milestoneMessage = memberCount % 100 === 0 ? `🏆 **MAJOR MILESTONE:** We've reached ${memberCount} members!` :
                memberCount % 10 === 0 ? `✨ **Growth Update:** ${memberCount} members and counting!` : '';

            let inviterDisplay = '`Unknown / Joined before tracking`';
            if (member.inviter) {
                inviterDisplay = `<@${member.inviter.id}> (\`${member.inviter.tag}\`)`;
            } else if (member.inviteCode === 'Vanity') {
                inviterDisplay = '`Vanity URL (Server Link)`';
            }

            const publicWelcomeEmbed = new EmbedBuilder()
                .setAuthor({
                    name: `New Member Arrival | Entry Log`,
                    iconURL: member.user.displayAvatarURL({ dynamic: true })
                })
                .setColor('#232428') // Premium Dark
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
                .setDescription(
                    `### <a:asinexegiveweays:1361729576828407828> Welcome to ${guild.name}!\n` +
                    `A new soul has joined the circle. Welcome aboard, ${member}! <a:11pm_puffheart:1448728817207349430>\n\n` +
                    `**👤 Identity Profile:**\n` +
                    `> **Account Age:** \`${accountAge} Days\`\n` +
                    `> **Join Position:** \`#${joinPosition}\`\n\n` +
                    `**🔗 Connection Details:**\n` +
                    `> **Invited By:** ${inviterDisplay}\n` +
                    `> **Member Status:** \`Human Citizen\`\n\n` +
                    `${milestoneMessage ? `> ${milestoneMessage}\n` : ''}`
                )
                .setImage('https://i.postimg.cc/zv5D2hYn/Kawaii-Welcome.jpg')
                .setFooter({
                    text: `Jebrila System | ${guild.memberCount} Members strong`,
                    iconURL: guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            // ═══════════════════════════════════════════════════════════════════════
            //                          SEND WELCOME DM
            // ═══════════════════════════════════════════════════════════════════════
            try {
                await member.send({ embeds: [welcomeDMEmbed] });
                console.log(`✅ Welcome DM sent successfully to ${member.user.tag}`);
            } catch (dmError) {
                console.log(`❌ Could not send welcome DM to ${member.user.tag}: ${dmError.message}`);

                // Create error embed for logging
                const errorEmbed = new EmbedBuilder()
                    .setTitle('⚠️ DM Delivery Failed')
                    .setDescription(`Could not send welcome DM to ${member.user.tag}\n**Reason:** ${dmError.message}`)
                    .setColor(config.colors.error)
                    .setTimestamp();

                // Try to log the error in welcome channel
                const welcomeChannel = guild.channels.cache.get(config.welcomeChannelId);
                if (welcomeChannel && welcomeChannel.type === ChannelType.GuildText) {
                    try {
                        await welcomeChannel.send({ embeds: [errorEmbed] });
                    } catch (logError) {
                        console.log(`❌ Could not log DM error: ${logError.message}`);
                    }
                }
            }

            // ═══════════════════════════════════════════════════════════════════════
            //                          SEND PUBLIC WELCOME
            // ═══════════════════════════════════════════════════════════════════════
            const welcomeChannel = guild.channels.cache.get(config.welcomeChannelId);
            if (welcomeChannel && welcomeChannel.type === ChannelType.GuildText) {
                try {
                    await welcomeChannel.send({
                        content: `🎉 ${member}`,
                        embeds: [publicWelcomeEmbed]
                    });
                    console.log(`✅ Public welcome message sent for ${member.user.tag}`);
                } catch (publicError) {
                    console.log(`❌ Could not send public welcome: ${publicError.message}`);
                }
            } else {
                console.log(`⚠️ Welcome channel not found or invalid (ID: ${config.welcomeChannelId})`);
            }

            // ═══════════════════════════════════════════════════════════════════════
            //                          AUTO-ROLE ASSIGNMENT
            // ═══════════════════════════════════════════════════════════════════════
            if (config.autoRoleId) {
                try {
                    const autoRole = guild.roles.cache.get(config.autoRoleId);
                    if (autoRole) {
                        await member.roles.add(autoRole);
                        console.log(`✅ Auto-role "${autoRole.name}" assigned to ${member.user.tag}`);
                    } else {
                        console.log(`⚠️ Auto-role not found (ID: ${config.autoRoleId})`);
                    }
                } catch (roleError) {
                    console.log(`❌ Could not assign auto-role to ${member.user.tag}: ${roleError.message}`);
                }
            }

            // ═══════════════════════════════════════════════════════════════════════
            //                          MEMBER STATISTICS
            // ═══════════════════════════════════════════════════════════════════════
            console.log(`📈 Member Statistics:`);
            console.log(`   • Total Members: ${memberCount}`);
            console.log(`   • Humans: ${guild.members.cache.filter(m => !m.user.bot).size}`);
            console.log(`   • Bots: ${guild.members.cache.filter(m => m.user.bot).size}`);
            console.log(`   • Account Age: ${accountAge} days`);
            console.log(`   • Join Position: #${joinPosition}`);

        } catch (error) {
            console.error(`❌ Error in guildMemberAdd event: ${error.message}`);
            console.error(error.stack);
        }
    },
};