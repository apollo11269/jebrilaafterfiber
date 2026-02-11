const mongoose = require('mongoose');

const RejectSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String },
    rejectedBy: { type: String },
    rejectedById: { type: String },
    reason: { type: String, required: true },
    rejectedAt: { type: Date, default: Date.now },
    previousRoles: [{ type: String }]
});

// Compound index to quickly find a specific user in a guild
RejectSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Reject', RejectSchema);
