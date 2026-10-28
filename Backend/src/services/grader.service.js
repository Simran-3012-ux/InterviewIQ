const { z } = require("zod")
const { generateJson } = require("./gemini.client")

/**
 * Rubric-based answer grading (LLM-as-a-judge).
 * Bump GRADER_VERSION whenever the rubric or prompt changes, so evaluation
 * results (scripts/evaluateGrader.js) can be compared across prompt versions.
 */
const GRADER_VERSION = "v1"

const RUBRIC = `
Score each criterion from 1 to 5 using these anchors:

CORRECTNESS - are the technical facts and claims accurate?
  1 = mostly wrong or irrelevant to the question
  2 = several significant errors
  3 = broadly correct with a notable error or gap
  4 = correct with only minor imprecision
  5 = fully correct and precise

DEPTH - does the answer go beyond surface level?
  1 = one-line or generic answer
  2 = names concepts without explaining them
  3 = explains the main idea but no trade-offs, examples or edge cases
  4 = explains with a concrete example or trade-off
  5 = covers trade-offs, edge cases and real experience, like a senior engineer

STRUCTURE - is the answer organised and easy to follow?
  1 = disorganised, hard to follow
  2 = some order but wanders or repeats
  3 = understandable with some rambling
  4 = clear order with a direct opening
  5 = leads with the answer, logical flow, concise conclusion

STAR (behavioral questions only, otherwise null) - Situation, Task, Action, Result
  1 = no story, only general statements
  2 = a situation but unclear personal actions
  3 = situation and actions, but the result is missing or vague
  4 = all four parts present, result not quantified or reflected on
  5 = all four parts, clear personal ownership, measurable result and a lesson learned
`

const gradeSchema = z.object({
    correctness: z.number().int().min(1).max(5),
    depth: z.number().int().min(1).max(5),
    structure: z.number().int().min(1).max(5),
    star: z.number().int().min(1).max(5).nullable().describe("null for technical questions"),
    strengths: z.array(z.string()).describe("1-3 specific strengths, referring to what the candidate said"),
    improvements: z.array(z.string()).describe("1-3 specific, actionable improvements"),
    firstKeyPointQuote: z.string().describe("Copy exactly the first 4-8 words where the candidate first directly answers the question. Empty string if they never do."),
})

async function gradeAnswer({ question, questionType, answer, role }) {
    if (!answer || !answer.trim()) {
        return emptyGrade(questionType)
    }

    const grade = await generateJson({
        schema: gradeSchema,
        temperature: 0,
        prompt: `You are a strict, calibrated interview grader for a ${role || "software"} role.
Grade only what the candidate actually said. Do not reward length for its own sake.
${RUBRIC}

QUESTION TYPE: ${questionType}
QUESTION: ${question}

CANDIDATE ANSWER (transcribed speech, filler words included):
"""${answer}"""

Return the scores. Set star to null when the question type is technical.`,
    })

    if (questionType !== "behavioral") grade.star = null
    return { ...grade, overall: overallScore(grade), graderVersion: GRADER_VERSION }
}

function overallScore({ correctness, depth, structure, star }) {
    const scores = [correctness, depth, structure, star].filter((s) => typeof s === "number")
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
}

function emptyGrade(questionType) {
    return {
        correctness: 1, depth: 1, structure: 1,
        star: questionType === "behavioral" ? 1 : null,
        strengths: [], improvements: ["No answer was given."],
        firstKeyPointQuote: "", overall: 1, graderVersion: GRADER_VERSION,
    }
}

module.exports = { gradeAnswer, GRADER_VERSION, RUBRIC }
