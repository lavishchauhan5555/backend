import User from "../Modals/user.js";
import nodemailer from "nodemailer";
import OTP from "../Modals/otp.js";
import bcrypt from "bcrypt";
import {requireAuth}  from "../Middlewares/auth.js"

import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js'

// Generate random 6-digit OTP
// function generateOTP() {
//   return Math.floor(100000 + Math.random() * 900000);
// }


const sendTokens = (res, userId) => {
  const accessToken = createAccessToken(userId);
  const refreshToken = createRefreshToken(userId);

  // Send refresh token as HttpOnly cookie
  res.cookie('jid', refreshToken, {
    httpOnly: true,
    secure: false, // change to true in production with HTTPS
    sameSite: 'lax',
    path: '/',
  });

  return accessToken;
};


const UserSignup = async (req, res) => {
  try {
    const { email, username, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    // const hashed = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      email,
      password,
    });


     res.json({ message: "Registration successful", user: newUser });

  } catch (error) {
    
    res.status(500).json({ message: "Signup failed ", success: false });
  }
};

// const verifyOtpAndRegister = async (req, res) => {
//   try {
//     const { username, email, password, otp } = req.body;

//     const validOtp = await OTP.findOne({
//       email,
//       otp,
//       expiresAt: { $gt: new Date() }, // check expiry
//     });

//     if (!validOtp)
//       return res.status(400).json({ message: "Invalid or expired OTP" });

//     // Hash password before saving
//     const hashed = await bcrypt.hash(password, 10);

//     const newUser = await User.create({
//       username,
//       email,
//       password: hashed,
//     });

//     // Delete OTP immediately after use
//     await OTP.deleteMany({ email });

//     res.json({ message: "Registration successful", user: newUser });

//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ error: "OTP verification failed" });
//   }
// };




// login controller logic
const logincontroller = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid credentials a" });

    const isMatch = await bcrypt.compare(password ,user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials b" });

    const accessToken = sendTokens(res, user._id);

   

    res.json({
      accessToken,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error", err);
    res.status(500).json({ message: "Server error" });
  }
}


// 

   const refreshpage = async (req, res) => {
  const token = req.cookies.jid;
  if (!token) return res.status(401).json({ message: 'No refresh token' });

  try {
    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ message: 'User not found' });

    const accessToken = sendTokens(res, user._id); // also rotates refresh token
    return res.json({
      accessToken,
      user: { id: user._id, email: user.email },
    });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: 'Refresh token invalid or expired' });
  }
}



//
const logout = async(req, res) => {
  res.clearCookie('jid', { path: '/refresh' });
  return res.json({ message: 'Logged out' });
}
export { UserSignup, logincontroller ,refreshpage,logout}