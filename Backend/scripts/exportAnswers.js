/**
 * Exports answers from mock interviews to eval/hand_grades.csv for hand grading.
 * Fill the human_* columns (1-5, human_star only for behavioral), then run evaluateGrader.js.
 *
 * Existing hand grades are kept: rows are merged by id, never overwritten.
 * Usage: npm run export:answers
 */
require("dotenv").config({ quiet: true })
const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")
const mockSessionModel = require("../src/models/mockSession.model")
const { parseCsv, toCsv } = require("./csv")

const GRADES_PATH = path.join(__dirname, "..", "eval", "hand_grades.csv")

const GRADE_COLUMNS = ["id", "questionType", "question", "answer", "human_correctness", "human_depth", "human_structure", "human_star", "notes"]

function mergeInto(filePath, columns, fresh) {
    const existing = fs.existsSync(filePath) ? parseCsv(fs.readFileSync(filePath, "utf8")) : []
    const known = new Set(existing.map((r) => r.id))
    const added = fresh.filter((r) => !known.has(r.id))
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, toCsv([...existing, ...added], columns))
    return { total: existing.length + added.length, added: added.length }
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI)
    const sessions = await mockSessionModel.find({ "turns.0": { $exists: true } }).lean()

    const answers = sessions.flatMap((s) => s.turns
        .map((t, i) => ({ id: `${s._id}-${i}`, turn: t }))
        .filter(({ turn }) => turn.transcript && turn.transcript.trim().split(/\s+/).length >= 5))

    const grades = mergeInto(GRADES_PATH, GRADE_COLUMNS, answers.map(({ id, turn }) => ({
        id, questionType: turn.questionType, question: turn.question, answer: turn.transcript,
    })))

    console.log(`Hand-grading sheet: ${grades.total} answers (${grades.added} new) -> ${GRADES_PATH}`)
    await mongoose.disconnect()
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
