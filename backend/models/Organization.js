const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, default: 'clinic', trim: true },
  city: { type: String, default: '', trim: true },
}, { timestamps: true });

organizationSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.createdAt = ret.createdAt?.toISOString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Organization', organizationSchema);
