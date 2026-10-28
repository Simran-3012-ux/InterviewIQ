const path = require('path')
const fs = require('fs')
const express = require('express')
const cookieParser = require('cookie-parser')
const cors = require('cors')


const app = express()

// Render and similar hosts sit behind a proxy; needed for secure cookies
app.set('trust proxy', 1)

// In development the Vite dev server runs on another port; in production the
// frontend is served by this app, so requests are same-origin.
app.use(cors({
    origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(','),
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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

// Serve the built React app (Frontend/dist) when it exists, with client-side routing fallback
const frontendDist = path.join(__dirname, '..', '..', 'Frontend', 'dist')
if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist))
    app.get(/^(?!\/api\/).*/, (req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'))
    })
}

module.exports = app
