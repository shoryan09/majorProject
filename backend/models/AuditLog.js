const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorId: { type: String, required: true },
  action: { type: String, required: true },
  target: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

auditLogSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.timestamp = ret.createdAt?.toISOString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
