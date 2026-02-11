const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'extractemojis',
    description: 'Extracts all server emojis and saves them to a configuration file',
    async execute(message, args) {
        const { getUserRoleLevel } = require('../utils/permissions.js');
        const userLevel = getUserRoleLevel(message.member);

        // Only administrators or Owner role can run this
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && userLevel !== 'owner') {
            return message.reply('❌ **Error:** Access Denied. Administrator or Owner permission required.');
        }

        const targetGuildId = '1201626435958354021'; // The requested Server ID
        const guild = message.client.guilds.cache.get(targetGuildId);

        if (!guild) {
            return message.reply(`❌ **Error:** I am not in the server with ID \`${targetGuildId}\`. Please make sure I am invited there.`);
        }

        try {
            await guild.emojis.fetch();
            const emojis = guild.emojis.cache;

            if (emojis.size === 0) {
                return message.reply('❌ **Error:** This server has no custom emojis.');
            }

            const emojiData = {};
            emojis.forEach(emoji => {
                emojiData[emoji.name] = {
                    id: emoji.id,
                    identifier: `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`,
                    animated: emoji.animated,
                    usage: "PLEASE_DEFINE_USE_CASE" // Here is where the user will fill it
                };
            });

            const configPath = path.join(__dirname, '..', 'config', 'emojis.json');

            // Ensure config directory exists
            const configDir = path.dirname(configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            fs.writeFileSync(configPath, JSON.stringify(emojiData, null, 4));

            const embed = new EmbedBuilder()
                .setTitle('📥 Emoji Extraction Complete')
                .setDescription(
                    `Successfully extracted **${emojis.size}** emojis from **${guild.name}**.\n\n` +
                    `### 📁 File Location:\n` +
                    `> \`config/emojis.json\`\n\n` +
                    `**Next Step:**\n` +
                    `Please open the file and replace \`PLEASE_DEFINE_USE_CASE\` with the keyword you want to use for each emoji (e.g., "admin", "success", "error").`
                )
                .setColor('#2ecc71')
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[Extract Emojis Error]:', error);
            message.reply('❌ **System Error:** Failed to extract emojis. Check console for details.');
        }
    },
};
