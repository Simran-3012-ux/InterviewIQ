const { z } = require("zod")
const { generateJson } = require("./gemini.client")

/**
 * Speech-to-text and delivery analysis for voice answers.
 * The browser records the answer, converts it to 16 kHz mono WAV and detects
 * silent stretches; the server transcribes with Gemini (multimodal audio input)
 * and computes the delivery metrics.
 */

const transcriptSchema = z.object({
    transcript: z.string().describe("Verbatim transcript of the speech, including filler words"),
})

async function transcribeAudio(buffer, mimeType = "audio/wav") {
    const { transcript } = await generateJson({
        schema: transcriptSchema,
        temperature: 0,
        prompt: `Transcribe this interview answer verbatim.
Keep every filler word and hesitation exactly as spoken (um, uh, erm, like, you know, basically, actually, I mean, sort of, kind of).
Do not correct grammar, do not summarise, and do not add speaker labels.
If there is no speech, return an empty transcript.`,
        parts: [{ inlineData: { mimeType, data: buffer.toString("base64") } }],
    })
    return transcript.trim()
}

// multi-word fillers first so "you know" is not also counted as other words
const FILLER_PATTERNS = {
    "you know": /\byou know\b/g,
    "i mean": /\bi mean\b/g,
    "sort of": /\bsort of\b/g,
    "kind of": /\bkind of\b/g,
    um: /\bu+m+\b/g,
    uh: /\bu+h+\b/g,
    erm: /\berm+\b/g,
    hmm: /\bhm+\b/g,
    basically: /\bbasically\b/g,
    actually: /\bactually\b/g,
    literally: /\bliterally\b/g,
    // "like" only when used as a filler: surrounded by commas or pauses
    like: /,\s*like\b|\blike\s*,/g,
}

const LONG_PAUSE_SEC = 2

function countWords(text) {
    return (text.match(/\b[\w']+\b/g) || []).length
}

function countFillers(transcript) {
    const text = transcript.toLowerCase()
    const fillers = {}
    let total = 0
    for (const [name, pattern] of Object.entries(FILLER_PATTERNS)) {
        const count = (text.match(pattern) || []).length
        if (count) {
            fillers[name] = count
            total += count
        }
    }
    return { fillers, total }
}

/**
 * Seconds from the start of the answer until the candidate first states the key point.
 * `firstKeyPointQuote` comes from the grader; we locate it in the transcript and
 * convert the number of words before it into time using the speaking rate.
 */
function timeToPoint({ transcript, firstKeyPointQuote, speakingTimeSec, responseLatencySec }) {
    if (!firstKeyPointQuote || !speakingTimeSec) return null
    const words = transcript.toLowerCase().match(/\b[\w']+\b/g) || []
    const quoteWords = firstKeyPointQuote.toLowerCase().match(/\b[\w']+\b/g) || []
    if (!words.length || !quoteWords.length) return null

    // find the first position where the opening words of the quote appear
    const probe = quoteWords.slice(0, Math.min(4, quoteWords.length))
    let index = -1
    for (let i = 0; i <= words.length - probe.length; i++) {
        if (probe.every((w, j) => words[i + j] === w)) { index = i; break }
    }
    if (index < 0) return null

    const secondsPerWord = speakingTimeSec / words.length
    return round((responseLatencySec || 0) + index * secondsPerWord)
}

/**
 * Builds the delivery metrics from the transcript and the client's audio analysis.
 * `pauses` are silent ranges detected in the browser: [{ start, end }] in seconds.
 */
function analyzeSpeech({ transcript, durationSec = 0, pauses = [], speechStartSec = 0 }) {
    const wordCount = countWords(transcript)
    const { fillers, total } = countFillers(transcript)

    const longPauses = pauses
        .filter((p) => p.end - p.start >= LONG_PAUSE_SEC && p.start >= speechStartSec)
        .map((p) => ({ start: round(p.start), end: round(p.end) }))
    const silentTime = pauses
        .filter((p) => p.start >= speechStartSec)
        .reduce((sum, p) => sum + (p.end - p.start), 0)

    const speakingTimeSec = Math.max(0, durationSec - speechStartSec - silentTime)

    return {
        durationSec: round(durationSec),
        speakingTimeSec: round(speakingTimeSec),
        wordCount,
        wordsPerMinute: speakingTimeSec > 0 ? Math.round(wordCount / (speakingTimeSec / 60)) : 0,
        fillerCount: total,
        fillerRate: wordCount ? round((total / wordCount) * 100) : 0,
        fillers,
        longPauses,
        longestPauseSec: round(Math.max(0, ...longPauses.map((p) => p.end - p.start))),
        responseLatencySec: round(speechStartSec),
        timeToPointSec: null,
    }
}

function round(n) {
    return Math.round(n * 10) / 10
}

module.exports = { transcribeAudio, analyzeSpeech, timeToPoint, countFillers, countWords }
