/**
 * Creates the Atlas Vector Search index used for question retrieval.
 * Run once after seeding:  node scripts/createVectorIndex.js
 * Requires MongoDB Atlas. On a local MongoDB the app falls back to in-memory search.
 */
require("dotenv").config({ quiet: true })
const mongoose = require("mongoose")
const questionBankModel = require("../src/models/questionBank.model")
const { EMBEDDING_DIMENSIONS } = require("../src/services/gemini.client")
const { VECTOR_INDEX } = require("../src/services/rag.service")

async function main() {
    await mongoose.connect(process.env.MONGO_URI)
    const collection = questionBankModel.collection

    const existing = await collection.listSearchIndexes(VECTOR_INDEX).toArray()
    if (existing.length) {
        console.log(`Index "${VECTOR_INDEX}" already exists (status: ${existing[0].status}).`)
    } else {
        await collection.createSearchIndex({
            name: VECTOR_INDEX,
            type: "vectorSearch",
            definition: {
                fields: [
                    { type: "vector", path: "embedding", numDimensions: EMBEDDING_DIMENSIONS, similarity: "cosine" },
                    { type: "filter", path: "type" },
                    { type: "filter", path: "role" },
                ],
            },
        })
        console.log(`Created "${VECTOR_INDEX}". Atlas needs about a minute to build it before queries use it.`)
    }
    await mongoose.disconnect()
}

main().catch((error) => {
    console.error(error.message)
    process.exit(1)
})
