module.exports = {
    name: 'inviteDelete',
    async execute(invite) {
        const { client } = invite;
        if (!client.invites) return;

        const guildInvites = client.invites.get(invite.guild.id);
        if (guildInvites) {
            guildInvites.delete(invite.code);
            console.log(`[Invites] Invite deleted: ${invite.code} in ${invite.guild.name}`);
        }
    },
};
