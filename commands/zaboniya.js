const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// File to store exempted users
const exemptedUsersFile = path.join(__dirname, '..', 'data', 'spam_exemptions.json');

// Memory Cache for performance
let exemptionsCache = null;

function loadExemptions() {
    if (exemptionsCache) return exemptionsCache;
    try {
        if (!fs.existsSync(path.dirname(exemptedUsersFile))) {
            fs.mkdirSync(path.dirname(exemptedUsersFile), { recursive: true });
        }
        if (fs.existsSync(exemptedUsersFile)) {
            exemptionsCache = JSON.parse(fs.readFileSync(exemptedUsersFile, 'utf8'));
            return exemptionsCache;
        }
    } catch (error) {
        console.error('Error loading spam exemptions:', error);
    }
    exemptionsCache = {};
    return exemptionsCache;
}

function saveExemptions(data) {
    try {
        exemptionsCache = data;
        fs.writeFileSync(exemptedUsersFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving spam exemptions:', error);
    }
}

module.exports = {
    name: 'zaboniya',
    description: 'Grant or revoke a user\'s VIP Immunity Status.',
    async execute(message, args) {
        // Permissions Check
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ **Security Access Denied:** Only administrators can grant VIP Immunity.');
        }

        let targetArg = args[0];
        let forceRemove = false;

        if (args[0] && (args[0].toLowerCase() === 'remove' || args[0].toLowerCase() === 'delete')) {
            targetArg = args[1];
            forceRemove = true;
        }

        const target = message.mentions.users.first() || await message.client.users.fetch(targetArg).catch(() => null);

        if (!target) {
            return message.reply(`❌ **Protocol Error:** Specify a valid entity (Mention or ID).\nUsage: \`!zaboniya <user>\` or \`!zaboniya remove <user>\``);
        }

        const guildId = message.guild.id;
        const exemptions = loadExemptions();

        if (!exemptions[guildId]) exemptions[guildId] = [];

        const isExempt = exemptions[guildId].includes(target.id);

        if (forceRemove || isExempt) {
            if (!isExempt) return message.reply(`⚠️ **${target.tag}** does not possess immunity status.`);

            // Revoke
            exemptions[guildId] = exemptions[guildId].filter(id => id !== target.id);
            saveExemptions(exemptions);

            const revokeEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Wisdom Security Registry', iconURL: message.guild.iconURL({ dynamic: true }) })
                .setTitle('🔰 Privilege Revoked')
                .setDescription(`**VIP Immunity Status** for ${target} has been **terminated**. This entity is now subject to standard auto-moderation protocols.`)
                .setColor('#e74c3c')
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `Revoked by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            return message.reply({ embeds: [revokeEmbed] });
        } else {
            // Grant
            exemptions[guildId].push(target.id);
            saveExemptions(exemptions);

            const grantEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Wisdom Security Registry', iconURL: message.guild.iconURL({ dynamic: true }) })
                .setTitle('🛡️ VIP Immunity Authorized')
                .setDescription(`**Access Granted.** ${target} is now invisible to the Wisdom auto-moderation grid (Anti-Spam & Antitag filters).`)
                .addFields({ name: '💎 Status', value: 'Immune / Whitelisted', inline: true })
                .setColor('#f1c40f') // Gold-ish color for VIP
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `Authorized by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            return message.reply({ embeds: [grantEmbed] });
        }
    },
    loadExemptions,
    saveExemptions
};
