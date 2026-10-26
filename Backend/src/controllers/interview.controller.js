const pdfParse = require("pdf-parse")
const mongoose = require("mongoose")
const {generateInterviewReport,generateResumePdf} = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")


async function generateInterviewReportController(req,res){
    if(!req.file){
        return res.status(400).json({ message: "Please upload your resume (PDF)." })
    }

    const { selfDescription, jobDescription} = req.body
    if(!jobDescription){
        return res.status(400).json({ message: "Job description is required." })
    }

    try{
        const resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText()

        const interviewReportByAi = await generateInterviewReport({
            resume:resumeContent.text,
            selfDescription,
            jobDescription
        })
        const interviewReport = await interviewReportModel.create({
            user:req.user.id,
            resume:resumeContent.text,
            selfDescription,
            jobDescription,
            ...interviewReportByAi
        })
        res.status(201).json({
            message:"Interview report generated succesfully",
            interviewReport
        })
    }catch(error){
        console.error("Generate interview report failed:", error)
        res.status(500).json({
            message: "Failed to generate interview report.",
            error: error.message
        })
    }
}


/**
 * @description Controller to get interview report by interviewId
 */
async function getInterviewReportByIdController(req,res){
    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id})

    if(!interviewReport){
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}

/**
 * @description Controller to get all interview reports of logged in user.
 */

async function getAllInterviewReportsController(req,res){
    const interviewReports = await interviewReportModel.find({ user:req.user.id}).sort({ createdAt: -1}).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavorialQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message:"Interview reports fetched successfully.",
        interviewReports
    })
}

/**
 * @description Controller to generate resume PDF based on self Description, resume and job Description.
 * Uses the data already saved in the interview report (by interviewReportId).
 */
async function generateResumePdfController(req,res){
    const { interviewReportId } = req.params

    if(!mongoose.isValidObjectId(interviewReportId)){
        return res.status(400).json({
            message: "Invalid interview report id. It should be a 24-character id."
        })
    }

    try{
        const interviewReport = await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id })

        if(!interviewReport){
            return res.status(404).json({
                message: "Interview report not found."
            })
        }

        const { resume, selfDescription, jobDescription } = interviewReport

        const pdfBuffer = await generateResumePdf({ resume, selfDescription, jobDescription })

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        })
        res.send(Buffer.from(pdfBuffer))
    }catch(error){
        console.error("Generate resume PDF failed:", error)
        res.status(500).json({
            message: "Failed to generate resume PDF.",
            error: error.message
        })
    }
}

module.exports = {generateInterviewReportController,getInterviewReportByIdController,getAllInterviewReportsController,generateResumePdfController}