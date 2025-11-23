// models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Name is required"],
    minlength: 2,
  },
//   role: {
//     type: String,
//     enum: ["user", "admin", "teacher"],
//     default: "user"
// },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: 6,
  },
}, { timestamps: true });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;