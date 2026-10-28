const express = require("express")
const multer = require("multer")
const authMiddleware = require("../middlewares/auth.middleware")
const mockController = require("../controllers/mock.controller")

const mockRouter = express.Router()

// recorded answers arrive as 16 kHz mono WAV (about 2 MB per minute)
const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
})

/**
 * @route POST /api/mock/start/:reportId
 * @description start a voice mock interview for an interview report
 * @access private
 */
mockRouter.post("/start/:reportId", authMiddleware.authUser, mockController.startMockInterviewController)

/**
 * @route POST /api/mock/session/:sessionId/answer
 * @description submit a voice (audio) or typed (text) answer; returns grading and the agent's next question
 * @access private
 */
mockRouter.post("/session/:sessionId/answer", authMiddleware.authUser, audioUpload.single("audio"), mockController.submitAnswerController)

/**
 * @route POST /api/mock/session/:sessionId/finish
 * @description end the interview and run the hiring committee
 * @access private
 */
mockRouter.post("/session/:sessionId/finish", authMiddleware.authUser, mockController.finishMockInterviewController)

/**
 * @route GET /api/mock/session/:sessionId
 * @description get a mock interview with all turns and the committee result
 * @access private
 */
mockRouter.get("/session/:sessionId", authMiddleware.authUser, mockController.getMockSessionController)

/**
 * @route GET /api/mock/report/:reportId
 * @description list mock interviews for a report
 * @access private
 */
mockRouter.get("/report/:reportId", authMiddleware.authUser, mockController.getMockSessionsForReportController)

module.exports = mockRouter
