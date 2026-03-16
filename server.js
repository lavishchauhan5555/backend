import dotenv from 'dotenv'
dotenv.config();
import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import fileUpload from "express-fileupload";
import { checkQdrantConnection } from "./Modals/check.js";
// const cookieParser = require('cookie-parser');
import cookieParser from 'cookie-parser'
import db from './Modals/db.js'
db();
import userauthrouter from './Routes/userauthrouter.js'
// import upload from './Routes/upload.js'
import deletechat from './Routes/deletechatroute.js'
import chatroute from './Routes/chat.routes.js'
import adminRoutes from "./Routes/admin.routes.js";
// import './Modals/Connection.js'
const app = express()
const port = process.env.PORT || 3000
app.use(cors({
  origin: "https://frontend-p07y.onrender.com",
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json());
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  abortOnLimit: false,
}));
app.get('/', (req, res) => {
  res.send('Hello World!')
})

 app.use('/auth',userauthrouter)
//  app.use('/auth',upload)
 app.use('/auth',deletechat)
 app.use('/auth',chatroute )
 app.use("/auth", adminRoutes);


app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
  checkQdrantConnection();
});