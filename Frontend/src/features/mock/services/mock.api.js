import axios from "axios";
import { API_BASE_URL } from "../../../lib/apiBase";

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
})

export const startMockInterview = async ({ reportId, maxMainQuestions }) => {
    const response = await api.post(`/api/mock/start/${reportId}`, { maxMainQuestions })
    return response.data
}

/**
 * Sends a voice answer (WAV blob + pause analysis) or a typed answer.
 */
export const submitAnswer = async ({ sessionId, audio, text, durationSec, speechStartSec, pauses }) => {
    const formData = new FormData()
    if (audio) {
        formData.append("audio", audio, "answer.wav")
        formData.append("durationSec", String(durationSec))
        formData.append("speechStartSec", String(speechStartSec))
        formData.append("pauses", JSON.stringify(pauses || []))
    } else {
        formData.append("text", text)
    }
    const response = await api.post(`/api/mock/session/${sessionId}/answer`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    })
    return response.data
}

export const finishMockInterview = async (sessionId) => {
    const response = await api.post(`/api/mock/session/${sessionId}/finish`)
    return response.data
}

export const getMockSession = async (sessionId) => {
    const response = await api.get(`/api/mock/session/${sessionId}`)
    return response.data
}

export const getMockSessionsForReport = async (reportId) => {
    const response = await api.get(`/api/mock/report/${reportId}`)
    return response.data
}

export const errorMessage = (error) =>
    error.response?.data?.error || error.response?.data?.message || error.message
