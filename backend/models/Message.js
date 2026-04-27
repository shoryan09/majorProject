const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderName: { type: String, default: 'User' },
  senderRole: { type: String, enum: ['patient', 'doctor', 'admin'], default: 'patient' },
  recipientId: { type: String, default: null },
  text: { type: String, required: true, maxlength: 2000 },
}, { timestamps: true });

messageSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.timestamp = ret.createdAt?.toISOString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Message', messageSchema);
