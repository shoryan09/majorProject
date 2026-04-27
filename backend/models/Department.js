const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  head: { type: String, default: '', trim: true },
}, { timestamps: true });

departmentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.createdAt = ret.createdAt?.toISOString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Department', departmentSchema);
