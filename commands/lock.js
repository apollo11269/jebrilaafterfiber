const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'lock',
    aliases: ['sed'],
    description: 'Lock the current channel with optional reason',
    async execute(message, args) {
        // Get the reason from arguments
        const reason = args.length > 0 ? args.join(' ') : 'No reason provided';
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
                    // Collect all role IDs that shouldn't be locked
                    protectedRoles = Object.values(rolesConfig).filter(id => id && id.length > 0 && id !== 'config/roles.json');
                }
            } catch (err) {
                console.error('Error loading roles config:', err);
            }

            // Get @everyone role
            const everyoneRole = message.guild.roles.everyone;

            // 1. Lock @everyone
            await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: false
            }, {
                reason: `Channel locked by ${message.author.tag}: ${reason}`
            });

            // 2. Lock all other roles found in permissions
            // We iterate through all existing overwrites to find roles that might have bypasses
            const overwrites = channel.permissionOverwrites.cache;

            let lockedCount = 0;

            for (const [id, overwrite] of overwrites) {
                // Skip @everyone (already handled)
                if (id === everyoneRole.id) continue;

                // Skip if it's a member overwrite (not a role)
                if (overwrite.type === 1) continue; // Type 0 is Role, 1 is Member. In djs v14: Type 0 = Role, Type 1 = Member

                // Skip protected/staff roles
                if (protectedRoles.includes(id)) continue;

                // Lock this role
                await channel.permissionOverwrites.edit(id, {
                    SendMessages: false
                }, {
                    reason: `Channel locked by ${message.author.tag} (Global Lock)`
                });
                lockedCount++;
            }

            const embed = new EmbedBuilder()
                .setTitle('🔒 Channel Locked')
                .setDescription(`**${channel.name}** has been locked for @everyone and ${lockedCount} other roles.`)
                .addFields(
                    { name: '📺 Channel', value: channel.toString(), inline: true },
                    { name: '👮 Moderator', value: message.author.tag, inline: true },
                    { name: '📝 Reason', value: reason, inline: false }
                )
                .setColor('#ff4757')
                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                .setTimestamp();

            message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error locking channel:', error);
            message.reply('❌ An error occurred while trying to lock the channel.');
        }
    },
};