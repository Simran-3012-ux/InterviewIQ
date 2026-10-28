const {GoogleGenAI} = require("@google/genai")
require("dotenv").config();
const {z} = require("zod")
const {zodToJsonSchema} = require("zod-to-json-schema")
const puppeteer = require("puppeteer")
const { retrieveQuestions } = require("./rag.service")


const ai = new GoogleGenAI({
    
    apiKey: process.env.GEMINI_API_KEY
})

async function invokeGeminiAi(){
    try{
    const response = await ai.models.generateContent({
        model:"gemini-3.5-flash-lite",
        contents:"Hello gemini! Explain what is Interview?"
    })
    console.log(response.text)

    return response.text;
}
catch(err){
    console.error("GEMINI ERROR");
    console.error(err);
}
}

const interviewReportSchema = z.object({
    matchScore:z.number().describe("A score betqween 0 and 100 indicating how well the candidate's profile matches the job description"),
    technicalQuestions:z.array(z.object({
        question:z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of the interviewer behind asking this question"),
        answer:z.string().describe("How to answer this question, what points to cover, what approach to take etc."),
        source:z.enum(["question_bank","generated"]).describe("question_bank if the question is taken or adapted from the REFERENCE QUESTIONS list, otherwise generated"),
    })).describe("Technical questions that can be asked in the interview along with their and intention and how to answer them"),
    behavorialQuestions:z.array(z.object({
        question:z.string().describe("The behavorial question can be asked in the interview"),
        intention: z.string().describe("The intention of the interviewer behind asking this question"),
        answer:z.string().describe("How to answer this question, what points to cover, what approach to take etc."),
        source:z.enum(["question_bank","generated"]).describe("question_bank if the question is taken or adapted from the REFERENCE QUESTIONS list, otherwise generated"),
    })).describe("Behavorial questions that can be asked in the interview along with their and intention and how to answer them"),
    skillGaps:z.array(z.object({
        skill:z.string().describe("The skill which the candidate is lacking"),
        severity:z.enum(["low","medium","high"]).describe("The severity of this skill gap"),
    })).describe("List of all skill gaps in the candidate's profile along with their severity"),
    preparationPlan:z.array(z.object({
        day:z.number().describe("the day in the prep"),
        focus:z.string().describe("The main focus of this day"),
        tasks:z.array(z.string()).describe("list of tasks to be done"),

    })).describe("A day-wise preparation plan for candidate to follow"),
    title:z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({resume,selfDescription,jobDescription}){

    // RAG: fetch real questions most similar to this job description to ground the report
    let referenceQuestions = []
    try {
        const [technical, behavioral] = await Promise.all([
            retrieveQuestions({ jobDescription, type: "technical", k: 8 }),
            retrieveQuestions({ jobDescription, type: "behavioral", k: 5 }),
        ])
        referenceQuestions = [...technical, ...behavioral]
    } catch (error) {
        console.error("Question retrieval failed, continuing without references:", error.message)
    }

    const referenceBlock = referenceQuestions.length
        ? referenceQuestions.map((q, i) => `${i + 1}. [${q.type} | ${q.topic} | company: ${q.company}] ${q.question}`).join("\n")
        : "None available."

    const prompt = `
You are an expert technical interviewer and career coach.

Generate a complete, personalized interview preparation report
using the candidate's resume, self-description, and job description.

CANDIDATE RESUME:
${resume}

SELF DESCRIPTION:
${selfDescription}

JOB DESCRIPTION:
${jobDescription}

REFERENCE QUESTIONS (real interview questions retrieved from the question bank, most relevant first):
${referenceBlock}

Requirements:
0. Ground the questions in the REFERENCE QUESTIONS: use or adapt the relevant ones first and mark
   them with source "question_bank". Only write new questions (source "generated") to cover
   topics the references miss. Never mark a question as question_bank unless it comes from the list.
1. Generate a matchScore from 0 to 100.
2. Generate at least 5 technicalQuestions relevant to the
   candidate's skills and the job description.
3. Each technical question must follow the required schema.
4. Generate at least 5 behavioralQuestions relevant to the
   candidate's experience and the role.
5. Each behavioral question must include question, intention,
   and answer fields.
6. Identify relevant skillGaps with severity values of low,
   medium, or high.
7. Generate a practical, day-wise preparationPlan.
8. Do not return empty question arrays when the supplied
   information is sufficient.
9. Do not invent candidate experience or qualifications.
10. Return data matching the provided JSON schema exactly.
` 
try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
  responseMimeType: "application/json",
  responseJsonSchema: z.toJSONSchema(interviewReportSchema),
},
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response");
    }

    const report = JSON.parse(response.text);

    // keep the retrieved questions with the report so the grounding is visible and auditable
    report.referenceQuestions = referenceQuestions.map(({ _id, question, type, topic, company, score }) => ({
        questionId: _id, question, type, topic, company, score,
    }))

    return report;
  } catch (error) {
    console.error("Gemini interview report error:", error.message);
    throw error;
  }
}

async function generatePdfFromHtml(htmlContent){
    const browser = await puppeteer.launch()
    try{
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "networkidle0"})

        const pdfBuffer = await page.pdf({
            format:"A4",
            printBackground: true,
            margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" }
        })
        return pdfBuffer
    } finally {
        // always close the browser, even if PDF creation fails
        await browser.close()
    }
}

const resumePdfSchema = z.object({
    html: z.string().describe("A complete, self-contained HTML document of the resume with inline CSS, ready to be converted to PDF")
})

async function generateResumePdf({ resume, selfDescription, jobDescription}){
    const prompt = `
You are an expert resume writer.

Rewrite the candidate's resume so it is tailored to the job description below,
using the candidate's resume and self description.

CANDIDATE RESUME:
${resume}

SELF DESCRIPTION:
${selfDescription || "Not provided"}

JOB DESCRIPTION:
${jobDescription}

Requirements:
1. Highlight the skills and experience most relevant to the job description.
2. Do not invent experience, companies, degrees or skills the candidate does not have.
3. Use a clean, professional, ATS-friendly single-column layout.
4. Use simple inline CSS only (no external fonts, images or scripts).
5. Keep it to 1-2 A4 pages.
6. Return a JSON object with a single field "html" containing the full HTML document.

the resume should be for the given job description and should highlight the candidate's strengths and relevant experience. The html content should be well-formatted and structured, amking it easy to read and visualize
The content of resume should be not sound like its generated by AI and should be as close as possible to be a real human-written resume.
you can highlight the content using some colors but the overall style should be simple and professional
the content should be ATS friendly i.e., should be easily parsable by ATS system without losing important information
`
    const response = await ai.models.generateContent({
        model:"gemini-3.5-flash-lite",
        contents: prompt,
        config:{
            responseMimeType:"application/json",
            responseJsonSchema: z.toJSONSchema(resumePdfSchema),
        }
    })

    if(!response.text){
        throw new Error("Gemini returned an empty response")
    }

    const { html } = JSON.parse(response.text)
    return generatePdfFromHtml(html)
}
module.exports = {generateInterviewReport, generateResumePdf};