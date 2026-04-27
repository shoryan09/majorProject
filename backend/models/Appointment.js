const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  doctorId: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
  notes: { type: String, default: '', maxlength: 1000 },
  createdBy: { type: String },
}, { timestamps: true });

appointmentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.createdAt = ret.createdAt?.toISOString();
    ret.updatedAt = ret.updatedAt?.toISOString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Appointment', appointmentSchema);
