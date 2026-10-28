const mongoose = require("mongoose")

/**
 * A real interview question in the retrieval bank (RAG).
 * `embedding` is searched with MongoDB Atlas Vector Search (index: question_vector_index).
 */
const questionBankSchema = new mongoose.Schema({
    question: { type: String, required: true, unique: true },
    type: { type: String, enum: ["technical", "behavioral"], required: true },
    role: { type: String, default: "general" },       // e.g. "frontend", "backend", "data"
    topic: { type: String, default: "general" },      // e.g. "react", "system design"
    company: { type: String, default: "unspecified" },
    difficulty: { type: Number, min: 1, max: 5, default: 3 },
    source: { type: String, default: "unspecified" }, // where the question was collected from
    embedding: { type: [Number], select: false },
}, { timestamps: true })

module.exports = mongoose.model("QuestionBank", questionBankSchema)
