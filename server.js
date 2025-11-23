import dotenv from 'dotenv'
dotenv.config();
import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import db from './Modals/db.js'
db();
import userauthrouter from './Routes/userauthrouter.js'
// import './Modals/Connection.js'
const app = express()
const port = 3000
app.use(cors({
  origin: "*",
  methods: "GET,POST,PUT,DELETE",
}));

app.use(bodyParser.json());
app.get('/', (req, res) => {
  res.send('Hello World!')
})

 app.use('/Auth',userauthrouter)


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})