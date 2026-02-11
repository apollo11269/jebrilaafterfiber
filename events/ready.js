const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const birthdaySettingsFile = path.join(__dirname, '..', 'data', 'birthday-settings.json');

// Load birthday settings from file
function loadBirthdaySettings() {
    try {
        if (fs.existsSync(birthdaySettingsFile)) {
            return JSON.parse(fs.readFileSync(birthdaySettingsFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading birthday settings:', error);
    }
    return {};
}

// Check for birthdays and send messages
async function checkBirthdays(client) {
    try {
        const settings = loadBirthdaySettings();
        const now = new Date();
        const currentDay = now.getDate();
        const currentMonth = now.getMonth() + 1;

        console.log(`[Birthday Checker] Checking birthdays for ${currentDay}/${currentMonth}`);

        // Check each guild's birthdays
        for (const [guildId, guildSettings] of Object.entries(settings)) {
            if (!guildSettings.birthdays || !guildSettings.channelId) continue;

            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;

            const birthdayChannel = guild.channels.cache.get(guildSettings.channelId);
            if (!birthdayChannel) continue;

            // Find today's birthdays
            const todaysBirthdays = [];
            for (const [userId, birthday] of Object.entries(guildSettings.birthdays)) {
                if (birthday.day === currentDay && birthday.month === currentMonth) {
                    const member = guild.members.cache.get(userId);
                    if (member) {
                        todaysBirthdays.push({ member, birthday });
                    }
                }
            }

            // Send birthday messages
            for (const { member, birthday } of todaysBirthdays) {
                try {
                    const birthdayEmbed = new EmbedBuilder()
                        .setTitle('🎉 Happy Birthday! 🎂')
                        .setDescription(`Today is **${member.displayName}**'s birthday!\n\nLet's all wish them a wonderful day! 🎈`)
                        .addFields(
                            {
                                name: '🎂 Birthday Person',
                                value: `${member}`,
                                inline: true
                            },
                            {
                                name: '📅 Date',
                                value: `${currentDay}/${currentMonth}`,
                                inline: true
                            },
                            {
                                name: '🎁 Birthday Wishes',
                                value: 'React with 🎉 to wish them a happy birthday!',
                                inline: false
                            }
                        )
                        .setColor('#FF69B4')
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .setFooter({
                            text: 'Jebrila System | By APOllO ❤ V69©',
                            iconURL: guild.iconURL({ dynamic: true })
                        })
                        .setTimestamp();

                    const birthdayMessage = await birthdayChannel.send({
                        content: `🎉 @everyone It's ${member.displayName}'s birthday today! 🎂`,
                        embeds: [birthdayEmbed]
                    });

                    // Add birthday reactions
                    await birthdayMessage.react('🎉');
                    await birthdayMessage.react('🎂');
                    await birthdayMessage.react('🎈');
                    await birthdayMessage.react('🎁');
                    await birthdayMessage.react('❤️');

                    console.log(`[Birthday Checker] Sent birthday message for ${member.displayName} in ${guild.name}`);

                    // Send a DM to the birthday person
                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('🎂 Happy Birthday from ' + guild.name + '! 🎉')
                            .setDescription(`Happy Birthday, **${member.displayName}**!\n\nWe hope you have a wonderful day filled with joy and celebration! 🎈\n\nYour birthday has been announced in the ${birthdayChannel} channel.`)
                            .setColor('#FF69B4')
                            .setThumbnail(guild.iconURL({ dynamic: true }))
                            .setFooter({
                                text: 'Jebrila System | By APOllO ❤ V69©',
                                iconURL: client.user.displayAvatarURL({ dynamic: true })
                            })
                            .setTimestamp();

                        await member.send({ embeds: [dmEmbed] });
                        console.log(`[Birthday Checker] Sent birthday DM to ${member.displayName}`);
                    } catch (dmError) {
                        console.log(`[Birthday Checker] Could not send DM to ${member.displayName}: ${dmError.message}`);
                    }

                } catch (error) {
                    console.error(`[Birthday Checker] Error sending birthday message for ${member.displayName}:`, error);
                }
            }

            if (todaysBirthdays.length > 0) {
                console.log(`[Birthday Checker] Processed ${todaysBirthdays.length} birthday(s) in ${guild.name}`);
            }
        }

    } catch (error) {
        console.error('[Birthday Checker] Error in birthday checker:', error);
    }
}

// Initialize birthday checker
function initializeBirthdayChecker(client) {
    console.log('[Birthday Checker] Initializing birthday checker...');

    // Set up daily check at midnight (00:00)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Schedule first check at next midnight
    setTimeout(() => {
        checkBirthdays(client);

        // Then check every 24 hours
        setInterval(() => {
            checkBirthdays(client);
        }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

    }, msUntilMidnight);

    console.log(`[Birthday Checker] Next birthday check scheduled for: ${tomorrow.toLocaleString()}`);
}

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`✅ ${client.user.tag} is online and ready!`);
        console.log(`📊 Serving ${client.guilds.cache.size} servers with ${client.users.cache.size} users`);

        // Function to update presence cycle
        let presenceIndex = 0;
        const updatePresence = () => {
            const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

            const presences = [
                { name: `${totalMembers} Members | Wisdom 🧠`, type: 3 }, // Watching
                { name: `Wisdom Circle Protocol ⚙️`, type: 0 },         // Playing
                { name: `Community Voice Feed 🔊`, type: 2 },          // Listening
                { name: `Security Clearance 🛡️`, type: 3 },             // Watching
                { name: `Alpha Genesis V6.9 💎`, type: 0 }              // Playing
            ];

            const current = presences[presenceIndex];
            client.user.setPresence({
                activities: [{
                    name: current.name,
                    type: current.type
                }],
                status: 'idle'
            });

            presenceIndex = (presenceIndex + 1) % presences.length;
        };

        // Initial update
        updatePresence();

        // Update every 15 seconds to cycle through states
        setInterval(updatePresence, 15000);

        // Create updateStats function
        const updateServerStats = async () => {
            const fs = require('fs');
            const path = require('path');
            const statsFile = path.join(__dirname, '..', 'data', 'server-stats.json');

            if (!fs.existsSync(statsFile)) return;

            let statsConfig = {};
            try {
                statsConfig = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
            } catch (e) {
                console.error('[Stats] Error reading config:', e);
                return;
            }

            for (const [guildId, config] of Object.entries(statsConfig)) {
                const guild = client.guilds.cache.get(guildId);
                if (!guild) continue;

                // Fetch members to get accurate numbers (especially for presence/online)
                // Note: 'withPresences: true' is needed if intent is enabled, else we rely on cache
                try {
                    await guild.members.fetch();
                } catch (e) { }

                const totalMembers = guild.memberCount;
                // Filter for online/idle/dnd. offline are excluded.
                // Note: Bot must have PRESENCE intent for this to work accurately on large servers
                const onlineMembers = guild.members.cache.filter(m => m.presence && m.presence.status !== 'offline').size;
                const voiceCount = guild.members.cache.filter(m => m.voice.channel).size;

                // Update Channels
                const updateChannelName = async (channelId, newName) => {
                    const channel = guild.channels.cache.get(channelId);
                    if (channel && channel.name !== newName) {
                        await channel.setName(newName).catch(e => console.error(`[Stats] Error updating channel ${channelId}:`, e.message));
                    }
                };

                await updateChannelName(config.totalChannelId, `👥 All Members: ${totalMembers}`);
                await updateChannelName(config.onlineChannelId, `🟢 Online: ${onlineMembers}`);
                await updateChannelName(config.voiceChannelId, `🎤 In Voice: ${voiceCount}`);
            }
        };

        // Initial Stats Update
        setTimeout(updateServerStats, 10000); // Wait 10s after startup

        // Schedule Stats Update every 10 minutes (600000 ms) - limiting to avoid API rate limits
        setInterval(updateServerStats, 600000);

        // Initialize invite cache
        client.invites = new Map();

        // Fetch invites for all guilds
        client.guilds.cache.forEach(async (guild) => {
            try {
                // Check if bot has permission to fetch invites
                if (!guild.members.me.permissions.has('ManageGuild')) {
                    console.log(`[Invites] Missing 'Manage Guild' permission in ${guild.name} to track invites.`);
                    return;
                }
                const guildInvites = await guild.invites.fetch();
                client.invites.set(guild.id, new Map(guildInvites.map((invite) => [invite.code, invite.uses])));
                console.log(`[Invites] Cached ${guildInvites.size} invites for ${guild.name}`);
            } catch (err) {
                console.log(`[Invites] Failed to fetch invites for ${guild.name}: ${err.message}`);
                // Set an empty map anyway to avoid errors later
                client.invites.set(guild.id, new Map());
            }
        });

        // Initialize birthday checker
        initializeBirthdayChecker(client);
    },
};