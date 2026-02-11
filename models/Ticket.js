const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    categoryId: { type: String, required: true },
    logChannelId: { type: String },
    setupChannelId: { type: String, required: true },
    activeTickets: [{
        userId: String,
        channelId: String,
        type: String,
        openedAt: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('Ticket', TicketSchema);
