const { z } = require("zod")
const { generateJson } = require("./gemini.client")

/**
 * Adaptive interviewer agent.
 * After every answer it reads the whole conversation (its memory) and decides
 * the next step: dig deeper, ask for clarification, move on, or end.
 * Difficulty rises when the candidate does well and drops when they struggle.
 */

const MAX_FOLLOW_UPS_PER_QUESTION = 2

const decisionSchema = z.object({
    action: z.enum(["follow_up", "clarify", "next_question", "end_interview"]),
    reasoning: z.string().describe("One or two sentences explaining the decision, referring to the candidate's answer"),
    newDifficulty: z.number().int().min(1).max(5),
    question: z.string().describe("For follow_up or clarify: the exact question to ask. For next_question: the chosen question, lightly rephrased to sound natural. Empty for end_interview."),
    chosenPoolId: z.string().describe("For next_question: the id of the chosen question from the pool. Empty otherwise."),
})

function formatHistory(turns) {
    return turns.map((t, i) => {
        const g = t.grade || {}
        return `Turn ${i} [${t.kind}, ${t.questionType}, difficulty ${t.difficulty}]
Interviewer: ${t.question}
Candidate: ${t.transcript || "(no answer)"}
Scores: correctness ${g.correctness}, depth ${g.depth}, structure ${g.structure}${g.star ? `, STAR ${g.star}` : ""}`
    }).join("\n\n")
}

/** Follow-ups asked since the last main question. */
function followUpsSinceMain(turns) {
    let count = 0
    for (let i = turns.length - 1; i >= 0 && turns[i].kind !== "main"; i--) count++
    return count
}

/**
 * Rule-based guard rails around the model's choice, so the interview always
 * terminates and difficulty moves at most one step per turn.
 */
function applyGuards(decision, session) {
    const turns = session.turns
    const mainAsked = turns.filter((t) => t.kind === "main").length
    const available = session.questionPool.filter((q) => !q.used)
    const lastOverall = turns.at(-1)?.grade?.overall ?? 3

    // keep difficulty changes gradual
    const current = session.difficulty
    let newDifficulty = Math.max(current - 1, Math.min(current + 1, decision.newDifficulty))
    if (lastOverall >= 4.5) newDifficulty = Math.min(5, Math.max(newDifficulty, current + 1))
    if (lastOverall <= 1.5) newDifficulty = Math.max(1, Math.min(newDifficulty, current - 1))
    decision.newDifficulty = newDifficulty

    const isFollowUp = decision.action === "follow_up" || decision.action === "clarify"
    if (isFollowUp && (followUpsSinceMain(turns) >= MAX_FOLLOW_UPS_PER_QUESTION || !decision.question)) {
        decision.action = "next_question"
    }

    if (decision.action === "next_question") {
        if (mainAsked >= session.maxMainQuestions || available.length === 0) {
            decision.action = "end_interview"
        } else if (!available.some((q) => q.id === decision.chosenPoolId)) {
            // model picked an invalid id: take the unused question closest to the target difficulty
            const pick = [...available].sort((a, b) => Math.abs(a.difficulty - newDifficulty) - Math.abs(b.difficulty - newDifficulty))[0]
            decision.chosenPoolId = pick.id
            decision.question = pick.question
        }
    }

    if (decision.action === "end_interview" && mainAsked < session.maxMainQuestions && available.length > 0 && !isFollowUp) {
        // don't let the agent stop early before the planned number of questions
        const pick = [...available].sort((a, b) => Math.abs(a.difficulty - newDifficulty) - Math.abs(b.difficulty - newDifficulty))[0]
        decision.action = "next_question"
        decision.chosenPoolId = pick.id
        decision.question = pick.question
    }

    return decision
}

async function decideNextStep(session, role) {
    const available = session.questionPool.filter((q) => !q.used)
    const mainAsked = session.turns.filter((t) => t.kind === "main").length

    const decision = await generateJson({
        schema: decisionSchema,
        temperature: 0.4,
        prompt: `You are an experienced interviewer running a live mock interview for: ${role}.
You remember the whole conversation below and decide what to do after the candidate's latest answer.

CONVERSATION SO FAR:
${formatHistory(session.turns)}

STATE:
- Current difficulty: ${session.difficulty} (1 = easy, 5 = very hard)
- Main questions asked: ${mainAsked} of ${session.maxMainQuestions}
- Follow-ups on the current topic: ${followUpsSinceMain(session.turns)} (maximum ${MAX_FOLLOW_UPS_PER_QUESTION})

QUESTION POOL (unused):
${available.map((q) => `- id ${q.id} | ${q.type} | difficulty ${q.difficulty} | ${q.question}`).join("\n") || "(empty)"}

HOW TO DECIDE:
- follow_up: the answer was promising but shallow, or mentioned something worth probing. Dig deeper into what they actually said.
- clarify: the answer was vague, ambiguous or contradictory. Ask them to clarify the specific unclear part.
- next_question: the topic is covered well enough, or further probing would not add signal. Choose from the pool,
  preferring a question near the new difficulty and a different topic or type for variety.
- end_interview: only when all main questions have been asked.
- Raise newDifficulty by 1 if the candidate is doing well (scores mostly 4-5), lower it by 1 if struggling (mostly 1-2), otherwise keep it.
- Never repeat a question that was already asked. Speak naturally, as a human interviewer would.`,
    })

    return applyGuards(decision, session)
}

module.exports = { decideNextStep, applyGuards, MAX_FOLLOW_UPS_PER_QUESTION }
