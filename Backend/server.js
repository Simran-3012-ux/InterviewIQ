require("dotenv").config()
const app = require('./src/app')
const connectToDB = require('./src/config/database')

connectToDB()

// hosting platforms such as Render provide the port in PORT
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})
