const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'role',
    description: 'Add or remove a role from a user',
    async execute(message, args) {
        // Check if user has manage roles permission
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('❌ You need Manage Roles permission to use this command!');
        }
        
        // Check if bot has manage roles permission
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('❌ I don\'t have permission to manage roles!');
        }
        
        const action = args[0]?.toLowerCase();
        if (!action || (action !== 'add' && action !== 'remove')) {
            return message.reply('❌ Please specify `add` or `remove`!\n**Usage:** `!role add @user @role` or `!role remove @user @role`');
        }
        
        const target = message.mentions.users.first();
        if (!target) {
            return message.reply('❌ Please mention a user!\n**Usage:** `!role add @user @role` or `!role remove @user @role`');
        }
        
        // Check for role mention first, then fallback to role name
        const roleMention = message.mentions.roles.first();
        let role;
        
        if (roleMention) {
            role = roleMention;
        } else {
            // Get role name from remaining args (skip action and user mention)
            const roleName = args.slice(1).filter(arg => !arg.startsWith('<@')).join(' ');
            if (!roleName) {
                return message.reply('❌ Please provide a role name or mention a role!\n**Usage:** `!role add @user @role` or `!role add @user RoleName`');
            }
            
            // Find the role by name or ID
            role = message.guild.roles.cache.find(r => 
                r.name.toLowerCase() === roleName.toLowerCase() ||
                r.id === roleName
            );
        }
        
        try {
            const member = await message.guild.members.fetch(target.id);
            
            // Role is already found above
            
            if (!role) {
                return message.reply('❌ Role not found!');
            }
            
            // Check if bot can manage this role
            if (role.position >= message.guild.members.me.roles.highest.position) {
                return message.reply('❌ I cannot manage this role as it is higher than or equal to my highest role!');
            }
            
            // Check if user can manage this role
            if (role.position >= message.member.roles.highest.position && message.author.id !== message.guild.ownerId) {
                return message.reply('❌ You cannot manage this role as it is higher than or equal to your highest role!');
            }
            
            let embed;
            
            if (action === 'add') {
                if (member.roles.cache.has(role.id)) {
                    return message.reply('❌ This user already has this role!');
                }
                
                await member.roles.add(role, `Role added by ${message.author.tag}`);
                console.log(`Role ${role.name} added to ${target.tag} by ${message.author.tag}`);
                
                // Verify the role was actually added
                await member.fetch(true); // Force refresh member data
                if (!member.roles.cache.has(role.id)) {
                    console.error(`Failed to add role ${role.name} to ${target.tag} - role not found after addition`);
                    return message.reply('❌ Failed to add the role. This might be due to role hierarchy or permission issues.');
                }
                
                embed = new EmbedBuilder()
                    .setTitle('✅ Role Added')
                    .setDescription(`**${role.name}** has been added to **${target.tag}**.`)
                    .setColor('#00ff00');
            } else {
                if (!member.roles.cache.has(role.id)) {
                    return message.reply('❌ This user doesn\'t have this role!');
                }
                
                await member.roles.remove(role, `Role removed by ${message.author.tag}`);
                console.log(`Role ${role.name} removed from ${target.tag} by ${message.author.tag}`);
                
                embed = new EmbedBuilder()
                    .setTitle('❌ Role Removed')
                    .setDescription(`**${role.name}** has been removed from **${target.tag}**.`)
                    .setColor('#ff4757');
            }
            
            embed.addFields(
                { name: '👤 User', value: `${target.tag} (${target.id})`, inline: true },
                { name: '👮 Moderator', value: message.author.tag, inline: true },
                { name: '🎭 Role', value: `${role.name} (${role.id})`, inline: true }
            )
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
            .setTimestamp();
            
            message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error managing role:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                rolePosition: role?.position,
                botHighestRole: message.guild.members.me.roles.highest.position,
                userHighestRole: message.member.roles.highest.position
            });
            
            if (error.code === 10007) {
                message.reply('❌ User not found in this server!');
            } else if (error.code === 50013) {
                message.reply('❌ Missing permissions! Make sure I have the "Manage Roles" permission and my role is higher than the role you\'re trying to manage.');
            } else {
                message.reply(`❌ An error occurred while trying to manage the role: ${error.message}`);
            }
        }
    },
};