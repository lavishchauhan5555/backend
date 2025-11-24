import express from 'express';
import {Uservalidation,loginautherouter} from '../Middlewares/uservalidation.js'
import {UserSignup,logincontroller} from '../Controllers/usercontroller.js'
const router = express.Router();
router.post('/signup',Uservalidation,UserSignup);
// router.post('/otp',verifyOtpAndRegister )
// login route
router.post('/login',loginautherouter,logincontroller)
export default router;