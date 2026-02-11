const mongoose = require('mongoose');

const WarningSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String },
    reason: { type: String, required: true },
    moderator: { type: String },
    moderatorId: { type: String },
    timestamp: { type: Date, default: Date.now }
});

// Index for fast lookup by user in a guild
WarningSchema.index({ guildId: 1, userId: 1 });

module.exports = mongoose.model('Warning', WarningSchema);
