import express from 'express';
import {deletechatcontroller} from '../Controllers/usercontroller.js'


const router = express.Router();
router.delete('/deletechat/:id',deletechatcontroller)

export default router;