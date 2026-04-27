const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['patient', 'doctor', 'admin'], default: 'patient' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  credentialStatus: { type: String, enum: ['pending', 'verified', 'rejected'] },
  profile: {
    phone: { type: String, default: '' },
    city: { type: String, default: '' },
    age: { type: String, default: '' },
    bloodGroup: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    specialization: { type: String, default: '' },
    licenseNumber: { type: String, default: '' },
    department: { type: String, default: '' },
    availability: { type: String, default: '' },
    adminTitle: { type: String, default: '' },
    organization: { type: String, default: '' },
    bio: { type: String, default: '' },
  },
}, { timestamps: true });

// Virtual 'id' field that mirrors _id as a string (for backward compatibility)
userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
