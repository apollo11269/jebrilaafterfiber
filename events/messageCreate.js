const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { loadAntitags } = require('../commands/antitag.js');
const { checkPermission, isBotOwner } = require('../utils/permissions.js');

// Anti-spam system storage
const userMessages = new Map();
const aliasCooldowns = new Map();
const spamSettings = {
    enabled: true,
    maxMessages: 5,      // Increased from 3
    timeWindow: 5000,
    duplicateThreshold: 3, // Increased from 2 (Allow 2, block 3rd)
    linkSpamThreshold: 3,  // Increased from 2
    capsThreshold: 75,     // Increased from 60 (More lenient)
    muteDuration: 300000   // 5 minutes
};

// Spam detection functions
function isSpamMessage(message) {
    if (!spamSettings.enabled) return false;

    const userId = message.author.id;
    const now = Date.now();

    // Initialize user data if not exists
    if (!userMessages.has(userId)) {
        userMessages.set(userId, {
            messages: [],
            lastMessage: '',
            duplicateCount: 0,
            linkCount: 0,
            warnings: 0
        });
    }

    const userData = userMessages.get(userId);

    // Clean old messages outside time window
    userData.messages = userData.messages.filter(msg => now - msg.timestamp < spamSettings.timeWindow);

    // Add current message
    userData.messages.push({
        content: message.content,
        timestamp: now
    });

    // Check for rapid messaging
    if (userData.messages.length > spamSettings.maxMessages) {
        return { type: 'rapid', count: userData.messages.length };
    }

    // Check for duplicate messages
    if (message.content === userData.lastMessage) {
        userData.duplicateCount++;
        if (userData.duplicateCount >= spamSettings.duplicateThreshold) {
            return { type: 'duplicate', count: userData.duplicateCount };
        }
    } else {
        userData.duplicateCount = 0;
        userData.lastMessage = message.content;
    }

    // Check for link spam
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    const links = message.content.match(linkRegex);
    if (links) {
        userData.linkCount++;
        if (userData.linkCount >= spamSettings.linkSpamThreshold) {
            return { type: 'links', count: userData.linkCount };
        }
    }

    // Check for excessive caps
    const capsCount = (message.content.match(/[A-Z]/g) || []).length;
    const totalLetters = (message.content.match(/[A-Za-z]/g) || []).length;
    if (totalLetters > 10 && (capsCount / totalLetters) * 100 > spamSettings.capsThreshold) {
        return { type: 'caps', percentage: Math.round((capsCount / totalLetters) * 100) };
    }

    return false;
}

async function handleSpam(message, spamData) {
    try {
        const userId = message.author.id;
        const userData = userMessages.get(userId);

        // 1. Delete the offending message
        await message.delete().catch(() => { });

        // 2. Decide: Warning or Timeout?
        if (!userData.warnings || userData.warnings < 1) {
            // --- FIRST STRIKE: WARNING ---
            userData.warnings = 1;

            const warnEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Security Intelligence: Spam Detected', iconURL: message.guild.iconURL({ dynamic: true }) })
                .setDescription(`${message.author}, **Stop!** System detected **${getSpamDescription(spamData)}**.\n\n> This is your **first and only** warning. Continuing will result in a temporary terminal lockout.`)
                .setColor('#f1c40f') // Yellow for warning
                .setFooter({ text: 'Wisdom Protection Protocol' });

            const warnMsg = await message.channel.send({ content: `${message.author}`, embeds: [warnEmbed] });
            setTimeout(() => warnMsg.delete().catch(() => { }), 7000);

        } else {
            // --- SECOND STRIKE: TIMEOUT ---
            await message.member.timeout(spamSettings.muteDuration, `Anti-spam: Repeated ${spamData.type} spam after warning`);

            const timeoutEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Security Enforcement: User Quarantined', iconURL: message.guild.iconURL({ dynamic: true }) })
                .setTitle('🚫 System Lockout Implemented')
                .setColor('#ff4757')
                .addFields(
                    { name: '👤 Target', value: `${message.author.tag}`, inline: true },
                    { name: '⚠️ Reason', value: getSpamDescription(spamData), inline: true },
                    { name: '⏳ Duration', value: `${spamSettings.muteDuration / 60000} Minutes`, inline: true }
                )
                .setThumbnail('https://i.postimg.cc/7ZTV4hfL/image.png')
                .setFooter({ text: 'Access Restoration Required later' })
                .setTimestamp();

            const alertMessage = await message.channel.send({ embeds: [timeoutEmbed] });
            setTimeout(() => alertMessage.delete().catch(() => { }), 15000);

            // Reset user's spam data after timeout
            userMessages.delete(userId);
        }
    } catch (error) {
        console.error('Error handling spam:', error);
    }
}

function getSpamDescription(spamData) {
    switch (spamData.type) {
        case 'rapid':
            return `Rapid messaging (${spamData.count} messages in ${spamSettings.timeWindow / 1000}s)`;
        case 'duplicate':
            return `Duplicate messages (${spamData.count} identical messages)`;
        case 'links':
            return `Link spam (${spamData.count} links in short time)`;
        case 'caps':
            return `Excessive caps (${spamData.percentage}% uppercase)`;
        default:
            return 'Spam detected';
    }
}

// Antitag protection handler
async function handleAntitagProtection(message) {
    // Skip if message has no mentions
    if (message.mentions.users.size === 0) return;

    // Skip if author has founders role (founders can bypass antitag)
    const { getUserRoleLevel } = require('../utils/permissions.js');
    const userLevel = getUserRoleLevel(message.member);
    if (userLevel === 'owner' || userLevel === 'founders') return;

    // Load antitag data
    const antitags = loadAntitags();
    const guildId = message.guild.id;

    if (!antitags[guildId]) return;

    // Check each mentioned user
    for (const mentionedUser of message.mentions.users.values()) {
        // Skip if mentioned user is the message author
        if (mentionedUser.id === message.author.id) continue;

        // Check if mentioned user has antitag protection
        if (antitags[guildId][mentionedUser.id]) {
            try {
                // Delete the message that contains the ping
                await message.delete();

                // Create warning embed
                const embed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setTitle('🚫 Don\'t Ping Me!')
                    .setDescription(`${message.author}, ${mentionedUser.username} has **antitag protection** enabled.\n\n**Your message was deleted because it contained an unwanted ping!**`)
                    .addFields(
                        { name: '⚠️ Auto-Moderation', value: 'Messages mentioning protected users are automatically removed.', inline: false },
                        { name: '💡 Alternative', value: 'Try sending a direct message or use their name without @ symbol.', inline: false },
                        { name: '🔧 How to disable', value: 'Protected users can use `!antitag off` to disable protection.', inline: false }
                    )
                    .setThumbnail(mentionedUser.displayAvatarURL())
                    .setFooter({ text: 'Antitag Auto-Moderation System', iconURL: message.guild.iconURL() })
                    .setTimestamp();

                // Send warning message
                const warningMsg = await message.channel.send({ embeds: [embed] });

                // Auto-delete warning after 15 seconds
                setTimeout(() => {
                    warningMsg.delete().catch(() => { });
                }, 15000);

            } catch (error) {
                console.error('Error handling antitag protection:', error);
            }

            // Only handle once per message, even if multiple protected users are mentioned
            return;
        }
    }
}

module.exports = {
    name: 'messageCreate',
    spamSettings, // Export settings for command access
    async execute(message) {
        // Ignore messages from bots
        if (message.author.bot) return;

        // Check for spam & antitag (skip for administrators & Zaboniya VIPs)
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const { loadExemptions } = require('../commands/zaboniya.js');
            const exemptions = loadExemptions();
            const guildExemptions = exemptions[message.guild.id] || [];

            if (!guildExemptions.includes(message.author.id)) {
                // Not a VIP -> Run Spam Check
                const spamCheck = isSpamMessage(message);
                if (spamCheck) {
                    handleSpam(message, spamCheck);
                    return;
                }

                // Not a VIP -> Run Antitag Protection
                await handleAntitagProtection(message);
            }
        }

        // Auto-Response System (Visible only to the user)
        const triggers = ['chkon', 'xkon', 'shkon', 'شكون', 'chkoun', 'shkoun'];
        const contentLower = message.content.toLowerCase();

        // Check if message is exactly the trigger or starts with the trigger followed by a space
        const isTriggered = triggers.some(trigger =>
            contentLower === trigger ||
            contentLower.startsWith(trigger + ' ')
        );

        if (isTriggered) {
            try {
                // Reply specifically to the user
                await message.reply('Li 7waak hh <a:CatLaughOmegaLUL:1448504998542573628>');
            } catch (error) {
                console.error('Error in auto-response:', error);
            }
            // We don't return here to allow commands to process if needed, though unlikely with these triggers
        }

        // Check for aliases without prefix (fte7, sed, mse7)
        const adminAliases = ['fte7', 'sed', 'mse7'];
        const noPrefixAliases = { 'a': 'avatar', '1': 'avatar', 'aji': 'move' };
        const messageContent = message.content.trim().toLowerCase();
        const firstWord = messageContent.split(' ')[0];

        if (adminAliases.includes(firstWord)) {
            // Handle aliases without prefix
            const args = message.content.trim().split(/ +/);
            const aliasName = args.shift().toLowerCase();

            // Map aliases to actual commands
            const aliasMap = {
                'fte7': 'unlock',
                'sed': 'lock',
                'mse7': 'clear'
            };

            const actualCommandName = aliasMap[aliasName];
            const command = message.client.commands.get(actualCommandName);

            if (command) {
                // Check permissions for the actual command
                const permissionCheck = await checkPermission(message, actualCommandName);

                if (!permissionCheck.allowed) {
                    return message.reply('⛔ ليس لديك صلاحية لاستعمال هذا الأمر.');
                }

                try {
                    command.execute(message, args);
                    return;
                } catch (error) {
                    console.error(`Error executing admin alias ${aliasName}:`, error);
                    message.reply('❌ There was an error executing this command!');
                    return;
                }
            }
        }

        if (noPrefixAliases[firstWord]) {
            const args = message.content.trim().split(/ +/);
            args.shift();
            const actualCommandName = noPrefixAliases[firstWord];
            const isAvatarAlias = actualCommandName === 'avatar';
            if (isAvatarAlias) {
                const botMentioned = message.mentions.users.has(message.client.user.id);
                if (!botMentioned) {
                    return;
                }
            }
            const cdKey = `${message.author.id}:${actualCommandName}`;
            const last = aliasCooldowns.get(cdKey) || 0;
            if (Date.now() - last < 10000) {
                return;
            }
            aliasCooldowns.set(cdKey, Date.now());
            const command = message.client.commands.get(actualCommandName);
            if (command) {
                const permissionCheck = await checkPermission(message, actualCommandName);
                if (!permissionCheck.allowed) {
                    if (firstWord === 'aji') return;
                    return message.reply('⛔ ليس لديك صلاحية لاستعمال هذا الأمر.');
                }
                try {
                    await command.execute(message, args);
                    return;
                } catch (error) {
                    console.error(`Error executing alias ${firstWord}:`, error);
                    message.reply('❌ There was an error executing this command!');
                    return;
                }
            }
        }

        // Check if message starts with prefix
        if (!message.content.startsWith(message.client.prefix)) return;

        // Parse command and arguments
        const args = message.content.slice(message.client.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Get command from collection
        const command = message.client.commands.get(commandName);
        if (!command) return;

        // Check permissions using the new role-based system
        const permissionCheck = await checkPermission(message, commandName);

        if (!permissionCheck.allowed) {
            return message.reply('⛔ ليس لديك صلاحية لاستعمال هذا الأمر.');
        }

        try {
            // Execute the command
            command.execute(message, args);
        } catch (error) {
            console.error(`Error executing command ${commandName}:`, error);
            message.reply('❌ There was an error executing this command!');
        }
    },
};
