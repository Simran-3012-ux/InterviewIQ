const mongoose = require("mongoose")
const interviewReportModel = require("../models/interviewReport.model")
const mockSessionModel = require("../models/mockSession.model")
const { retrieveQuestions } = require("../services/rag.service")
const { transcribeAudio, analyzeSpeech, timeToPoint, countFillers, countWords } = require("../services/speech.service")
const { gradeAnswer } = require("../services/grader.service")
const { decideNextStep } = require("../services/interviewer.agent")
const { runCommittee } = require("../services/committee.service")

async function findOwnSession(req, res) {
    const { sessionId } = req.params
    if (!mongoose.isValidObjectId(sessionId)) {
        res.status(400).json({ message: "Invalid session id." })
        return null
    }
    const session = await mockSessionModel.findOne({ _id: sessionId, user: req.user.id })
    if (!session) res.status(404).json({ message: "Mock interview not found." })
    return session
}

/**
 * Candidate questions for the agent: the report's own questions plus real
 * questions retrieved from the question bank for this job description.
 */
async function buildQuestionPool(report) {
    const pool = [
        ...report.technicalQuestions.map((q, i) => ({ id: `rt${i}`, question: q.question, type: "technical", difficulty: 3, origin: "report" })),
        ...report.behavorialQuestions.map((q, i) => ({ id: `rb${i}`, question: q.question, type: "behavioral", difficulty: 3, origin: "report" })),
    ]
    try {
        const retrieved = await retrieveQuestions({ jobDescription: report.jobDescription, k: 8 })
        const seen = new Set(pool.map((q) => q.question.toLowerCase()))
        for (const q of retrieved) {
            if (seen.has(q.question.toLowerCase())) continue
            pool.push({ id: `qb${q._id}`, question: q.question, type: q.type, difficulty: q.difficulty, origin: "question_bank" })
        }
    } catch (error) {
        console.error("Question bank retrieval failed for mock interview:", error.message)
    }
    return pool
}

/**
 * @route POST /api/mock/start/:reportId
 */
async function startMockInterviewController(req, res) {
    const { reportId } = req.params
    if (!mongoose.isValidObjectId(reportId)) {
        return res.status(400).json({ message: "Invalid interview report id." })
    }
    try {
        const report = await interviewReportModel.findOne({ _id: reportId, user: req.user.id })
        if (!report) return res.status(404).json({ message: "Interview report not found." })

        const maxMainQuestions = Math.min(8, Math.max(2, Number(req.body?.maxMainQuestions) || 4))
        const pool = await buildQuestionPool(report)
        if (!pool.length) return res.status(400).json({ message: "This report has no questions to practise." })

        // open with a technical question from the report at medium difficulty
        const first = pool.find((q) => q.type === "technical") || pool[0]
        first.used = true

        const session = await mockSessionModel.create({
            user: req.user.id,
            report: report._id,
            title: report.title,
            maxMainQuestions,
            difficulty: 3,
            questionPool: pool,
            currentQuestion: { question: first.question, questionType: first.type, kind: "main", difficulty: first.difficulty, origin: first.origin },
        })

        res.status(201).json({ message: "Mock interview started.", session })
    } catch (error) {
        console.error("Start mock interview failed:", error)
        res.status(500).json({ message: "Failed to start the mock interview.", error: error.message })
    }
}

/**
 * @route POST /api/mock/session/:sessionId/answer
 * multipart/form-data: audio (WAV, optional), text (optional), durationSec, speechStartSec, pauses (JSON)
 */
async function submitAnswerController(req, res) {
    try {
        const session = await findOwnSession(req, res)
        if (!session) return
        if (session.status !== "in_progress" || !session.currentQuestion?.question) {
            return res.status(400).json({ message: "This mock interview has no open question." })
        }

        const current = session.currentQuestion
        const report = await interviewReportModel.findById(session.report).select("title")
        const role = report?.title || session.title || "software engineer"

        // 1. speech-to-text and delivery analysis (or typed answer)
        let transcript, speech, answerMode
        if (req.file) {
            answerMode = "voice"
            transcript = await transcribeAudio(req.file.buffer, req.file.mimetype || "audio/wav")
            let pauses = []
            try { pauses = JSON.parse(req.body.pauses || "[]") } catch { pauses = [] }
            speech = analyzeSpeech({
                transcript,
                durationSec: Number(req.body.durationSec) || 0,
                speechStartSec: Number(req.body.speechStartSec) || 0,
                pauses,
            })
        } else if (req.body.text?.trim()) {
            answerMode = "text"
            transcript = req.body.text.trim()
            const { fillers, total } = countFillers(transcript)
            const wordCount = countWords(transcript)
            speech = { wordCount, fillerCount: total, fillers, fillerRate: wordCount ? Math.round((total / wordCount) * 1000) / 10 : 0 }
        } else {
            return res.status(400).json({ message: "Send a recorded answer or a typed answer." })
        }

        // 2. rubric grading (LLM-as-a-judge)
        const grade = await gradeAnswer({ question: current.question, questionType: current.questionType, answer: transcript, role })
        if (answerMode === "voice") {
            speech.timeToPointSec = timeToPoint({
                transcript,
                firstKeyPointQuote: grade.firstKeyPointQuote,
                speakingTimeSec: speech.speakingTimeSec,
                responseLatencySec: speech.responseLatencySec,
            })
        }

        session.turns.push({
            question: current.question,
            questionType: current.questionType,
            kind: current.kind,
            difficulty: current.difficulty,
            origin: current.origin,
            answerMode,
            transcript,
            speech,
            grade,
            answeredAt: new Date(),
        })

        // 3. adaptive agent decides what happens next, with the whole conversation as memory
        const decision = await decideNextStep(session, role)
        const turn = session.turns[session.turns.length - 1]
        turn.agentDecision = { action: decision.action, reasoning: decision.reasoning, newDifficulty: decision.newDifficulty }
        session.difficulty = decision.newDifficulty

        if (decision.action === "follow_up" || decision.action === "clarify") {
            session.currentQuestion = {
                question: decision.question, questionType: current.questionType,
                kind: decision.action, difficulty: decision.newDifficulty, origin: "agent",
            }
        } else if (decision.action === "next_question") {
            const picked = session.questionPool.find((q) => q.id === decision.chosenPoolId)
            picked.used = true
            session.currentQuestion = {
                question: decision.question || picked.question, questionType: picked.type,
                kind: "main", difficulty: picked.difficulty, origin: picked.origin,
            }
        } else {
            session.currentQuestion = undefined
        }

        await session.save()
        res.status(200).json({
            message: "Answer evaluated.",
            turn: session.turns[session.turns.length - 1],
            nextQuestion: session.currentQuestion?.question ? session.currentQuestion : null,
            difficulty: session.difficulty,
            done: !session.currentQuestion?.question,
        })
    } catch (error) {
        console.error("Submit answer failed:", error)
        res.status(500).json({ message: "Failed to evaluate the answer.", error: error.message })
    }
}

/**
 * @route POST /api/mock/session/:sessionId/finish
 * Ends the interview and runs the hiring committee.
 */
async function finishMockInterviewController(req, res) {
    try {
        const session = await findOwnSession(req, res)
        if (!session) return
        if (!session.turns.length) {
            return res.status(400).json({ message: "Answer at least one question before finishing." })
        }
        if (session.status === "completed" && session.committee?.decision) {
            return res.status(200).json({ message: "Already completed.", session })
        }

        const report = await interviewReportModel.findById(session.report).select("title")
        session.committee = await runCommittee(session, report?.title || session.title || "software engineer")
        session.status = "completed"
        session.currentQuestion = undefined
        await session.save()

        res.status(200).json({ message: "Mock interview completed.", session })
    } catch (error) {
        console.error("Finish mock interview failed:", error)
        res.status(500).json({ message: "Failed to run the hiring committee.", error: error.message })
    }
}

/**
 * @route GET /api/mock/session/:sessionId
 */
async function getMockSessionController(req, res) {
    const session = await findOwnSession(req, res)
    if (!session) return
    res.status(200).json({ message: "Mock interview fetched.", session })
}

/**
 * @route GET /api/mock/report/:reportId
 */
async function getMockSessionsForReportController(req, res) {
    const { reportId } = req.params
    if (!mongoose.isValidObjectId(reportId)) {
        return res.status(400).json({ message: "Invalid interview report id." })
    }
    const sessions = await mockSessionModel
        .find({ user: req.user.id, report: reportId })
        .sort({ createdAt: -1 })
        .select("title status createdAt committee.decision committee.score turns.grade.overall")
    res.status(200).json({ message: "Mock interviews fetched.", sessions })
}

module.exports = {
    startMockInterviewController,
    submitAnswerController,
    finishMockInterviewController,
    getMockSessionController,
    getMockSessionsForReportController,
}
