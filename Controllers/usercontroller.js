import User from "../Modals/user.js";
import nodemailer from "nodemailer";
import OTP from "../Modals/otp.js";
import bcrypt from "bcrypt";

// Generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000);
}

const UserSignup = async (req, res) => {
  try {
    const { email, username, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      email,
      password: hashed,
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
    if (!user) {
      return res.status(401).json({ message: "user not rejister ,Please Signup", success: false })
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }  // token valid for 7 days
    );
    res.json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Login failed", error: error.message });

  }
}
export { UserSignup, logincontroller }