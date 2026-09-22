const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  referralCode: { type: String, unique: true },
  referredBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  if (!this.referralCode) {
    this.referralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
