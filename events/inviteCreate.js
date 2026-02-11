module.exports = {
    name: 'inviteCreate',
    async execute(invite) {
        const { client } = invite;
        if (!client.invites) return;

        let guildInvites = client.invites.get(invite.guild.id);
        if (!guildInvites) {
            guildInvites = new Map();
            client.invites.set(invite.guild.id, guildInvites);
        }

        guildInvites.set(invite.code, invite.uses);
        console.log(`[Invites] New invite created: ${invite.code} in ${invite.guild.name}`);
    },
};
