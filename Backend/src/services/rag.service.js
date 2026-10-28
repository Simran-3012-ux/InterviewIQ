const questionBankModel = require("../models/questionBank.model")
const { embedTexts } = require("./gemini.client")

const VECTOR_INDEX = "question_vector_index"

/**
 * Builds the text that gets embedded for a question. Including the tags helps
 * retrieval match on role and topic, not only on wording.
 */
function questionToEmbeddingText(q) {
    return `${q.type} interview question | role: ${q.role} | topic: ${q.topic}\n${q.question}`
}

/**
 * Chunks a long job description into overlapping word windows so each part is
 * searched on its own. Long text embedded as one vector tends to blur the details.
 */
function chunkText(text, wordsPerChunk = 120, overlap = 30) {
    const words = (text || "").split(/\s+/).filter(Boolean)
    if (words.length <= wordsPerChunk) return [words.join(" ")]

    const chunks = []
    for (let start = 0; start < words.length; start += wordsPerChunk - overlap) {
        chunks.push(words.slice(start, start + wordsPerChunk).join(" "))
        if (start + wordsPerChunk >= words.length) break
    }
    return chunks
}

/**
 * Retrieves the most relevant real questions for a job description.
 * Uses Atlas Vector Search and falls back to in-memory cosine similarity
 * when the vector index is not available (for example on a local MongoDB).
 */
async function retrieveQuestions({ jobDescription, type, k = 8 }) {
    const total = await questionBankModel.estimatedDocumentCount()
    if (total === 0) return []

    const chunks = chunkText(jobDescription).slice(0, 5)
    const queryVectors = await embedTexts(chunks, "RETRIEVAL_QUERY")

    // best score per question across all chunks
    const best = new Map()
    for (const vector of queryVectors) {
        const hits = await searchOneVector(vector, type, k)
        for (const hit of hits) {
            const id = String(hit._id)
            if (!best.has(id) || best.get(id).score < hit.score) best.set(id, hit)
        }
    }

    return [...best.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map(({ embedding, ...rest }) => rest)
}

async function searchOneVector(vector, type, k) {
    try {
        return await questionBankModel.aggregate([
            {
                $vectorSearch: {
                    index: VECTOR_INDEX,
                    path: "embedding",
                    queryVector: vector,
                    numCandidates: k * 15,
                    limit: k,
                    ...(type ? { filter: { type } } : {}),
                },
            },
            { $project: { question: 1, type: 1, role: 1, topic: 1, company: 1, difficulty: 1, source: 1, score: { $meta: "vectorSearchScore" } } },
        ])
    } catch (error) {
        // vector index missing or not on Atlas: compute similarity in Node instead
        return bruteForceSearch(vector, type, k)
    }
}

async function bruteForceSearch(vector, type, k) {
    const docs = await questionBankModel.find(type ? { type } : {}).select("+embedding").lean()
    return docs
        .filter((d) => d.embedding?.length === vector.length)
        .map((d) => ({ ...d, score: dot(d.embedding, vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
}

// vectors are normalized, so the dot product equals cosine similarity
function dot(a, b) {
    let sum = 0
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
    return sum
}

module.exports = { retrieveQuestions, questionToEmbeddingText, chunkText, VECTOR_INDEX }
