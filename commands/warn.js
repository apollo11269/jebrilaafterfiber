const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const Warning = require('../models/Warning');

module.exports = {
    name: 'warn',
    description: 'Warn a member with a professional system',
    async execute(message, args) {
        try {
            const target = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);

            if (!target) {
                return message.reply('❌ **Error:** Please mention a valid user or provide their ID.');
            }

            if (target.id === message.author.id) {
                return message.reply('❌ **Error:** Self-harm is not allowed! You cannot warn yourself.');
            }

            if (target.bot) {
                return message.reply('❌ **Error:** Bots are immune to warnings.');
            }

            const reason = args.slice(1).join(' ') || 'No reason provided';
            const guildId = message.guild.id;

            // Save warning to MongoDB
            const newWarning = new Warning({
                guildId: guildId,
                userId: target.id,
                username: target.tag,
                reason: reason,
                moderator: message.author.tag,
                moderatorId: message.author.id
            });
            await newWarning.save();

            // Fetch total warnings for the user
            const userWarnings = await Warning.find({ guildId, userId: target.id });
            const warnCount = userWarnings.length;

            // Premium Embed Design
            const warnEmbed = new EmbedBuilder()
                .setAuthor({
                    name: `Disciplinary Action | Case #${newWarning._id.toString().slice(-6)}`,
                    iconURL: target.displayAvatarURL({ dynamic: true })
                })
                .setColor(warnCount >= 3 ? '#ff4757' : '#ffa502')
                .setThumbnail('https://i.postimg.cc/zv5D2hYn/Kawaii-Welcome.jpg') // Reusing assets or themed imagery
                .setTitle('⚠️ Formal Warning Issued')
                .setDescription(
                    `The user **${target.tag}** has received a formal warning for violating community guidelines.\n\n` +
                    `### 📑 Violation Details:\n` +
                    `> **User:** ${target} (\`${target.id}\`)\n` +
                    `> **Reason:** \`${reason}\`\n` +
                    `> **Moderator:** ${message.author}\n` +
                    `> **Severity:** ${warnCount >= 3 ? '🔴 CRITICAL' : warnCount === 2 ? '🟡 MODERATE' : '🟢 MINOR'}\n\n` +
                    `**Total Offenses:** \`${warnCount} / 3\``
                )
                .setFooter({
                    text: `Jebrila Security | Enforcement Protocol`,
                    iconURL: message.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            // DM the user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setAuthor({ name: `Security Alert | ${message.guild.name}`, iconURL: message.guild.iconURL({ dynamic: true }) })
                    .setTitle('⚠️ Warning Notification')
                    .setDescription(
                        `Hello **${target.username}**, this is an official notification regarding a warning placed on your account.\n\n` +
                        `**Reason:** \`${reason}\`\n` +
                        `**Warning State:** \`${warnCount} of 3\`\n\n` +
                        `Please review our rules to avoid further disciplinary actions.`
                    )
                    .setColor('#ffa502')
                    .setTimestamp();
                await target.send({ embeds: [dmEmbed] });
            } catch (dmErr) {
                console.log(`[Warn] Could not DM ${target.tag}`);
            }

            // Handle auto-kick at 3 warnings
            if (warnCount >= 3) {
                const member = await message.guild.members.fetch(target.id).catch(() => null);
                if (member && member.kickable) {
                    await member.kick(`[Auto-Kick] Reached 3 warnings. Last: ${reason}`).catch(console.error);
                    warnEmbed.addFields({
                        name: '🚨 Terminal Action',
                        value: `The user has been **Auto-Kicked** for reaching the threshold of 3 warnings.`
                    });
                } else {
                    warnEmbed.addFields({
                        name: '🚨 Terminal Action',
                        value: `Threshold reached (\`3/3\`), but user is **un-kickable** (Missing Perms/Higher Role).`
                    });
                }
            }

            await message.reply({ embeds: [warnEmbed] });

        } catch (error) {
            console.error('[Warn Error]:', error);
            message.reply('❌ **System Error:** Failed to process the warning protocol.');
        }
    },
};