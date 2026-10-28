const mongoose = require("mongoose")

/**
 * A voice mock interview. The list of turns is the interviewer agent's memory:
 * the full conversation is sent back to the agent before every decision.
 */

const gradeSchema = new mongoose.Schema({
    correctness: Number,
    depth: Number,
    structure: Number,
    star: { type: Number, default: null },   // only for behavioral answers
    overall: Number,
    strengths: [String],
    improvements: [String],
    firstKeyPointQuote: String,
    graderVersion: String,
}, { _id: false })

const speechSchema = new mongoose.Schema({
    durationSec: Number,
    speakingTimeSec: Number,
    wordCount: Number,
    wordsPerMinute: Number,
    fillerCount: Number,
    fillerRate: Number,                         // fillers per 100 words
    fillers: { type: Map, of: Number },
    longPauses: [{ _id: false, start: Number, end: Number }],
    longestPauseSec: Number,
    responseLatencySec: Number,                 // silence before the first word
    timeToPointSec: { type: Number, default: null },
}, { _id: false })

const turnSchema = new mongoose.Schema({
    question: { type: String, required: true },
    questionType: { type: String, enum: ["technical", "behavioral"], default: "technical" },
    kind: { type: String, enum: ["main", "follow_up", "clarify"], default: "main" },
    difficulty: { type: Number, min: 1, max: 5, default: 3 },
    origin: { type: String, default: "report" },   // report | question_bank | agent
    answerMode: { type: String, enum: ["voice", "text"], default: "voice" },
    transcript: String,
    speech: speechSchema,
    grade: gradeSchema,
    agentDecision: {
        action: String,
        reasoning: String,
        newDifficulty: Number,
    },
    answeredAt: Date,
}, { _id: false })

const committeeMemberSchema = new mongoose.Schema({
    role: String,
    initialVote: String,
    finalVote: String,
    confidence: Number,
    summary: String,
    evidence: [{
        _id: false,
        turnIndex: Number,
        quote: String,
        assessment: String,
        verified: Boolean,                         // quote actually appears in the transcript
    }],
    concerns: [String],
    rebuttal: String,
    changedVote: Boolean,
}, { _id: false })

const mockSessionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    report: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewReport", required: true },
    title: String,
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
    maxMainQuestions: { type: Number, default: 5 },
    difficulty: { type: Number, min: 1, max: 5, default: 3 },
    // candidate questions the agent can pick from (report questions + retrieved bank questions)
    questionPool: [{
        _id: false,
        id: String,
        question: String,
        type: { type: String },
        difficulty: Number,
        origin: String,
        used: { type: Boolean, default: false },
    }],
    turns: [turnSchema],
    currentQuestion: {
        question: String,
        questionType: String,
        kind: String,
        difficulty: Number,
        origin: String,
    },
    committee: {
        members: [committeeMemberSchema],
        decision: String,                          // hire | no_hire
        score: Number,
        rationale: String,
        decidedAt: Date,
    },
}, { timestamps: true })

module.exports = mongoose.model("MockSession", mockSessionSchema)
