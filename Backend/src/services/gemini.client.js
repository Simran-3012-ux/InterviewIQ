const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
require("dotenv").config()

/**
 * Shared Gemini client and helpers used by every AI feature.
 * Model names can be overridden from .env without code changes.
 */
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const MODELS = {
    text: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    embedding: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
}

const EMBEDDING_DIMENSIONS = 768

/**
 * Calls Gemini and returns JSON that matches the given Zod schema.
 * `parts` lets callers send extra content such as audio alongside the prompt.
 */
async function generateJson({ prompt, schema, parts = [], temperature }) {
    const response = await withRetry(() => ai.models.generateContent({
        model: MODELS.text,
        contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }],
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(schema),
            ...(temperature !== undefined ? { temperature } : {}),
        },
    }))

    if (!response.text) {
        throw new Error("Gemini returned an empty response")
    }

    // validate so the rest of the app can trust the shape
    return schema.parse(JSON.parse(response.text))
}

/**
 * Embeds a list of texts. taskType should be RETRIEVAL_DOCUMENT for stored
 * items and RETRIEVAL_QUERY for search queries.
 */
async function embedTexts(texts, taskType = "RETRIEVAL_DOCUMENT") {
    const response = await withRetry(() => ai.models.embedContent({
        model: MODELS.embedding,
        contents: texts,
        config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
    }))
    return response.embeddings.map((e) => normalize(e.values))
}

/**
 * Retries a Gemini call when the rate limit (HTTP 429) is hit, waiting for the
 * delay Gemini suggests. Other errors are thrown immediately.
 */
async function withRetry(fn, attempts = 4) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn()
        } catch (error) {
            if (error.status !== 429 || attempt >= attempts) throw error
            const suggested = /retry in ([\d.]+)s/i.exec(error.message || "")
            const waitMs = suggested ? Math.ceil(Number(suggested[1]) * 1000) + 1000 : 15000 * attempt
            console.warn(`Gemini rate limit reached, retrying in ${Math.round(waitMs / 1000)}s...`)
            await new Promise((resolve) => setTimeout(resolve, waitMs))
        }
    }
}

// Gemini embeddings below 3072 dimensions are not normalized, so normalize for cosine similarity
function normalize(vector) {
    const length = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1
    return vector.map((v) => v / length)
}

module.exports = { ai, MODELS, EMBEDDING_DIMENSIONS, generateJson, embedTexts, withRetry }
