const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'guildMemberRemove',
    async execute(member) {
        console.log(`[Leave Log] Event triggered for ${member.user.tag}`);
        try {
            const guild = member.guild;
            const leaveChannelId = process.env.leave_channel_id;

            if (!leaveChannelId) {
                console.log(`[Leave Log] No leave_channel_id configured in .env for ${guild.name}`);
                return;
            }

            let leaveChannel = guild.channels.cache.get(leaveChannelId);

            // Try to fetch if not in cache
            if (!leaveChannel) {
                try {
                    leaveChannel = await guild.channels.fetch(leaveChannelId).catch(() => null);
                } catch (e) { }
            }

            if (!leaveChannel) {
                console.log(`[Leave Log] Leave channel not found in ${guild.name} (ID: ${leaveChannelId})`);
                return;
            }

            // Load inviter data
            const invitesPath = path.join(__dirname, '..', 'data', 'invites.json');
            let inviterData = {};
            if (fs.existsSync(invitesPath)) {
                try {
                    inviterData = JSON.parse(fs.readFileSync(invitesPath, 'utf8'));
                } catch (err) { console.error('Error parsing invites file:', err); }
            }

            const guildInvites = inviterData[guild.id] || {};
            const userData = guildInvites[member.id];

            let inviterText = '`Unknown (Joined before tracking)`';
            if (userData) {
                if (userData.inviterId === 'Vanity') {
                    inviterText = '`Vanity URL (Server Link)`';
                } else {
                    inviterText = `<@${userData.inviterId}> (\`${userData.inviterTag}\`)`;
                }
            }

            // Calculate stay duration
            const joinedAt = member.joinedTimestamp;
            const leftAt = Date.now();
            const stayDurationMs = leftAt - joinedAt;

            const days = Math.floor(stayDurationMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((stayDurationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const stayText = `${days} Days, ${hours} Hours`;

            const leaveEmbed = new EmbedBuilder()
                .setAuthor({
                    name: `Member Departure | Log`,
                    iconURL: member.user.displayAvatarURL({ dynamic: true })
                })
                .setColor('#232428') // Premium Dark
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
                .setDescription(
                    `### 👋 Farewell, ${member.user.username}!\n` +
                    `A member has just left the community. Here are the session details:\n\n` +
                    `**👤 User Information:**\n` +
                    `> **Name:** ${member.user}\n` +
                    `> **Tag:** \`${member.user.tag}\`\n` +
                    `> **ID:** \`${member.id}\`\n\n` +
                    `**⏳ Server Activity:**\n` +
                    `> **Joined:** <t:${Math.floor(joinedAt / 1000)}:R>\n` +
                    `> **Stayed for:** \`${stayText}\`\n\n` +
                    `**🔗 Origin Details:**\n` +
                    `> **Invited By:** ${inviterText}`
                )
                .setImage('https://i.postimg.cc/26W3Kmqc/Goodbye.jpg')
                .setFooter({
                    text: `Jebrila System | ${guild.memberCount} Members remaining`,
                    iconURL: guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            await leaveChannel.send({ embeds: [leaveEmbed] });
            console.log(`[Leave Log] Logged departure of ${member.user.tag} in ${guild.name}`);

            // Optionally clean up data
            // delete guildInvites[member.id];
            // fs.writeFileSync(invitesPath, JSON.stringify(inviterData, null, 2));

        } catch (error) {
            console.error(`❌ Error in guildMemberRemove event: ${error.message}`);
        }
    },
};
