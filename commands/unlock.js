const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'unlock',
    aliases: ['fte7'],
    description: 'Unlock the current channel',
    async execute(message, args) {
        // Check if bot has manage channels permission
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ I don\'t have permission to manage channels!');
        }

        const channel = message.channel;

        try {
            // Load protected roles
            const fs = require('fs');
            const path = require('path');
            let protectedRoles = [];

            try {
                const rolesConfigPath = path.join(__dirname, '..', 'config', 'roles.json');
                if (fs.existsSync(rolesConfigPath)) {
                    const rolesConfig = JSON.parse(fs.readFileSync(rolesConfigPath, 'utf8'));
                    // Collect all role IDs that shouldn't be touched
                    protectedRoles = Object.values(rolesConfig).filter(id => id && id.length > 0 && id !== 'config/roles.json');
                }
            } catch (err) {
                console.error('Error loading roles config:', err);
            }

            // Get @everyone role
            const everyoneRole = message.guild.roles.everyone;

            // Check if channel is actually locked for everyone
            // We can still check this, but we'll proceed to unlock others too
            const permissions = channel.permissionOverwrites.cache.get(everyoneRole.id);
            const isEveryoneLocked = permissions && permissions.deny.has(PermissionFlagsBits.SendMessages);

            // 1. Unlock @everyone
            if (permissions) {
                await channel.permissionOverwrites.edit(everyoneRole, {
                    SendMessages: null
                }, {
                    reason: `Channel unlocked by ${message.author.tag}`
                });
            }

            // 2. Unlock all other roles
            const overwrites = channel.permissionOverwrites.cache;
            let unlockedCount = 0;

            for (const [id, overwrite] of overwrites) {
                // Skip @everyone (already handled)
                if (id === everyoneRole.id) continue;

                // Skip if it's a member overwrite (not a role)
                if (overwrite.type === 1) continue;

                // Skip protected/staff roles
                if (protectedRoles.includes(id)) continue;

                // Check if this role has SendMessages explicitly denied or allowed
                // We set it to null to reset it (unlock)
                await channel.permissionOverwrites.edit(id, {
                    SendMessages: null
                }, {
                    reason: `Channel unlocked by ${message.author.tag} (Global Unlock)`
                });
                unlockedCount++;
            }

            const embed = new EmbedBuilder()
                .setTitle('🔓 Channel Unlocked')
                .setDescription(`**${channel.name}** has been unlocked for @everyone and ${unlockedCount} other roles.`)
                .addFields(
                    { name: '📺 Channel', value: channel.toString(), inline: true },
                    { name: '👮 Moderator', value: message.author.tag, inline: true }
                )
                .setColor('#00ff00')
                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                .setTimestamp();

            message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error unlocking channel:', error);
            message.reply('❌ An error occurred while trying to unlock the channel.');
        }
    },
};