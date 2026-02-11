const mongoose = require('mongoose');

const RoleRequestSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    roleType: { type: String, required: true },
    reason: { type: String, required: true },
    commitment: { type: String, required: true }, // "Will you use it for a clean community?"
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' },
    moderatorId: { type: String },
    moderatorTag: { type: String },
    rejectionReason: { type: String },
    acceptedRoleId: { type: String },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RoleRequest', RoleRequestSchema);
