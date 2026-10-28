const { z } = require("zod")
const { generateJson } = require("./gemini.client")

/**
 * Hiring committee: three role-prompted agents review the interview transcript.
 * Round 1: each reviews independently and votes, citing the candidate's own words.
 * Round 2: each reads the others' reviews, responds, and may change their vote.
 * Final:   votes are aggregated with confidence weights; the bar raiser can veto.
 */

const MEMBERS = [
    {
        role: "Tech Lead",
        focus: "technical correctness and depth, problem-solving approach, whether this person could ship and own production code on your team from week one",
    },
    {
        role: "HR Partner",
        focus: "communication clarity, collaboration, ownership and self-awareness in behavioral answers, motivation and culture add, delivery (filler words, pace, getting to the point)",
    },
    {
        role: "Bar Raiser",
        focus: "whether this candidate is better than half of the people currently in this role, long-term potential, consistency across answers, and any red flags. You are deliberately hard to convince",
    },
]

const VOTES = ["strong_no_hire", "no_hire", "hire", "strong_hire"]
const VOTE_SCORE = { strong_no_hire: -2, no_hire: -1, hire: 1, strong_hire: 2 }

const reviewSchema = z.object({
    vote: z.enum(VOTES),
    confidence: z.number().min(0).max(1).describe("How confident you are in your vote, 0 to 1"),
    summary: z.string().describe("Two or three sentence assessment"),
    evidence: z.array(z.object({
        turnIndex: z.number().int(),
        quote: z.string().describe("Exact words copied from the candidate's answer in that turn"),
        assessment: z.string().describe("What this quote shows, positive or negative"),
    })).describe("2-4 pieces of evidence citing the candidate's actual answers"),
    concerns: z.array(z.string()),
})

const debateSchema = z.object({
    finalVote: z.enum(VOTES),
    confidence: z.number().min(0).max(1),
    rebuttal: z.string().describe("Respond to the other members by name: where you agree, where you disagree and why, citing the transcript"),
})

function formatTranscript(session) {
    return session.turns.map((t, i) => {
        const s = t.speech
        const delivery = s?.wordCount
            ? ` | delivery: ${s.wordsPerMinute} wpm, ${s.fillerCount} fillers, longest pause ${s.longestPauseSec}s`
            : ""
        return `Turn ${i} [${t.kind}, ${t.questionType}${delivery}]
Interviewer: ${t.question}
Candidate: ${t.transcript || "(no answer)"}`
    }).join("\n\n")
}

// a citation counts as verified when its words appear in order in that turn's answer
function verifyQuote(session, turnIndex, quote) {
    const answer = (session.turns[turnIndex]?.transcript || "").toLowerCase().replace(/[^\w\s']/g, " ").replace(/\s+/g, " ")
    const q = (quote || "").toLowerCase().replace(/[^\w\s']/g, " ").replace(/\s+/g, " ").trim()
    return q.length > 0 && answer.includes(q)
}

async function initialReview(member, transcript, roleTitle) {
    return generateJson({
        schema: reviewSchema,
        temperature: 0.3,
        prompt: `You are the ${member.role} on a hiring committee for the role: ${roleTitle}.
Your focus: ${member.focus}.

Review the mock interview transcript below and vote. Base every claim on what the candidate actually said,
and quote their exact words as evidence. Do not invent anything that is not in the transcript.

TRANSCRIPT:
${transcript}`,
    })
}

async function debate(member, ownReview, others, transcript, roleTitle) {
    const othersText = others.map((o) => `${o.role} voted ${o.review.vote} (confidence ${o.review.confidence}):
${o.review.summary}
Concerns: ${o.review.concerns.join("; ") || "none"}`).join("\n\n")

    return generateJson({
        schema: debateSchema,
        temperature: 0.3,
        prompt: `You are the ${member.role} on a hiring committee for the role: ${roleTitle}. Your focus: ${member.focus}.
You voted ${ownReview.vote}: ${ownReview.summary}

The other committee members said:
${othersText}

Debate: challenge points you disagree with and acknowledge good points, citing the transcript.
Change your vote only if their arguments are convincing. Then give your final vote.

TRANSCRIPT:
${transcript}`,
    })
}

async function runCommittee(session, roleTitle) {
    const transcript = formatTranscript(session)

    // Round 1: independent reviews in parallel, so members don't anchor on each other
    const reviews = await Promise.all(MEMBERS.map((m) => initialReview(m, transcript, roleTitle)))

    // Round 2: each member responds to the others
    const debates = await Promise.all(MEMBERS.map((m, i) => debate(
        m,
        reviews[i],
        MEMBERS.map((o, j) => ({ role: o.role, review: reviews[j] })).filter((_, j) => j !== i),
        transcript,
        roleTitle,
    )))

    const members = MEMBERS.map((m, i) => ({
        role: m.role,
        initialVote: reviews[i].vote,
        finalVote: debates[i].finalVote,
        confidence: debates[i].confidence,
        summary: reviews[i].summary,
        evidence: reviews[i].evidence.map((e) => ({ ...e, verified: verifyQuote(session, e.turnIndex, e.quote) })),
        concerns: reviews[i].concerns,
        rebuttal: debates[i].rebuttal,
        changedVote: reviews[i].vote !== debates[i].finalVote,
    }))

    return { ...aggregate(members), members, decidedAt: new Date() }
}

/**
 * Confidence-weighted vote. A strong_no_hire from the Bar Raiser is a veto.
 */
function aggregate(members) {
    const weighted = members.reduce((sum, m) => sum + VOTE_SCORE[m.finalVote] * (0.5 + m.confidence / 2), 0)
    const score = Math.round((weighted / members.length) * 100) / 100
    const barRaiser = members.find((m) => m.role === "Bar Raiser")
    const veto = barRaiser?.finalVote === "strong_no_hire"

    const decision = !veto && score > 0 ? "hire" : "no_hire"
    const tally = members.map((m) => `${m.role}: ${m.finalVote.replace(/_/g, " ")}`).join(", ")
    const rationale = veto
        ? `Bar Raiser vetoed with strong no hire. Votes - ${tally}.`
        : `Weighted score ${score} (range -2 to 2). Votes - ${tally}.`

    return { decision, score, rationale }
}

module.exports = { runCommittee, aggregate, verifyQuote, MEMBERS }
