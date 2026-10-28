const express = require('express')
const cookieParser = require('cookie-parser')
const cors = require('cors')


const app = express()
app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())

/*require all the routes her*/
const authRouter = require('./routes/auth.routes')
const interviewRouter = require("./routes/interview.routes")
const mockRouter = require("./routes/mock.routes")

/*use the routes here*/
app.use('/api/auth', authRouter)
app.use("/api/interview",interviewRouter)
app.use("/api/mock", mockRouter)

module.exports = app
