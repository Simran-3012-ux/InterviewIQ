/**
 * Loads interview questions from a CSV file, embeds them with Gemini and
 * upserts them into the QuestionBank collection.
 *
 * Usage:  node scripts/seedQuestionBank.js [path/to/questions.csv]
 * CSV columns: question,type,role,topic,difficulty,company,source
 */
require("dotenv").config({ quiet: true })
const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")
const questionBankModel = require("../src/models/questionBank.model")
const { embedTexts } = require("../src/services/gemini.client")
const { questionToEmbeddingText } = require("../src/services/rag.service")
const { parseCsv } = require("./csv")

const BATCH_SIZE = 50

async function main() {
    const file = process.argv[2] || path.join(__dirname, "..", "data", "question_bank.csv")
    const records = parseCsv(fs.readFileSync(file, "utf8"))
        .filter((r) => r.question && ["technical", "behavioral"].includes(r.type))
        .map((r) => ({
            question: r.question,
            type: r.type,
            role: r.role || "general",
            topic: r.topic || "general",
            company: r.company || "unspecified",
            difficulty: Math.min(5, Math.max(1, Number(r.difficulty) || 3)),
            source: r.source || "unspecified",
        }))

    console.log(`Loaded ${records.length} questions from ${file}`)
    await mongoose.connect(process.env.MONGO_URI)

    // skip questions that are already embedded, so an interrupted run can resume
    const done = new Set((await questionBankModel.find({ embedding: { $exists: true, $ne: [] } }).select("question").lean()).map((d) => d.question))
    const pending = records.filter((r) => !done.has(r.question))
    console.log(`${records.length - pending.length} already embedded, ${pending.length} to embed`)
    records.length = 0
    records.push(...pending)

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE)
        const vectors = await embedTexts(batch.map(questionToEmbeddingText), "RETRIEVAL_DOCUMENT")

        await questionBankModel.bulkWrite(batch.map((q, j) => ({
            updateOne: {
                filter: { question: q.question },
                update: { $set: { ...q, embedding: vectors[j] } },
                upsert: true,
            },
        })))
        console.log(`Embedded and saved ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`)
    }

    console.log(`Question bank now holds ${await questionBankModel.countDocuments()} questions.`)
    await mongoose.disconnect()
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
