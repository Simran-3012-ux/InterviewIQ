const mongoose = require('mongoose');

const RETRY_DELAY_MS = 10000

/**
 * Connects to MongoDB and keeps retrying if the first attempt fails
 * (for example while Atlas network access is still being applied),
 * instead of leaving the server running without a database.
 */
async function connectToDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
    console.log('Connected to MongoDB')
  }
  catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`)
    console.error(`Retrying in ${RETRY_DELAY_MS / 1000} seconds...`)
    setTimeout(connectToDB, RETRY_DELAY_MS)
  }
}

module.exports = connectToDB
