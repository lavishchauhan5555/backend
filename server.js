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
import upload from './Routes/upload.js'
// import './Modals/Connection.js'
const app = express()
const port = 3000
app.use(cors({ 
 origin: "http://localhost:5173", // frontend URL
  methods: "GET,POST,PUT,DELETE",
  credentials: true,
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

 app.use('/Auth',userauthrouter)
 app.use('/Auth',upload)


app.listen(port, () => {
  console.log(`Example app listening on port ${port} `)
  checkQdrantConnection();
})