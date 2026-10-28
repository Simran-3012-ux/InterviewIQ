/**
 * Audio helpers for voice answers.
 * - Records with MediaRecorder
 * - Decodes and resamples to 16 kHz mono, encodes as WAV (a format Gemini accepts)
 * - Detects when speech starts and where the silent pauses are, using frame energy (RMS)
 */

const TARGET_SAMPLE_RATE = 16000
const FRAME_SEC = 0.05          // 50 ms analysis frames
const MIN_PAUSE_SEC = 0.4       // shorter gaps are normal between words

export async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    const recorder = new MediaRecorder(stream)
    const chunks = []
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    recorder.start()

    return {
        stop: () => new Promise((resolve) => {
            recorder.onstop = () => {
                stream.getTracks().forEach((t) => t.stop())
                resolve(new Blob(chunks, { type: recorder.mimeType }))
            }
            recorder.stop()
        }),
    }
}

/** Converts a recording to WAV and returns it with timing analysis. */
export async function processRecording(blob) {
    const arrayBuffer = await blob.arrayBuffer()
    const context = new AudioContext()
    const decoded = await context.decodeAudioData(arrayBuffer)
    context.close()

    // resample to 16 kHz mono
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE), TARGET_SAMPLE_RATE)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    const rendered = await offline.startRendering()
    const samples = rendered.getChannelData(0)

    const { speechStartSec, pauses } = analyzeSilence(samples, TARGET_SAMPLE_RATE)
    return {
        wav: encodeWav(samples, TARGET_SAMPLE_RATE),
        durationSec: samples.length / TARGET_SAMPLE_RATE,
        speechStartSec,
        pauses,
    }
}

/** Finds silent stretches. The threshold adapts to the room's background noise. */
function analyzeSilence(samples, sampleRate) {
    const frameSize = Math.floor(sampleRate * FRAME_SEC)
    const energies = []
    for (let i = 0; i + frameSize <= samples.length; i += frameSize) {
        let sum = 0
        for (let j = i; j < i + frameSize; j++) sum += samples[j] * samples[j]
        energies.push(Math.sqrt(sum / frameSize))
    }
    if (!energies.length) return { speechStartSec: 0, pauses: [] }

    const sorted = [...energies].sort((a, b) => a - b)
    const noiseFloor = sorted[Math.floor(sorted.length * 0.2)]
    const loud = sorted[Math.floor(sorted.length * 0.9)]
    const threshold = Math.max(0.006, noiseFloor + (loud - noiseFloor) * 0.15)

    const voiced = energies.map((e) => e > threshold)
    const first = voiced.indexOf(true)
    const last = voiced.lastIndexOf(true)
    if (first === -1) return { speechStartSec: 0, pauses: [] }

    const pauses = []
    let runStart = null
    for (let f = first; f <= last; f++) {
        if (!voiced[f] && runStart === null) runStart = f
        if (voiced[f] && runStart !== null) {
            const start = runStart * FRAME_SEC, end = f * FRAME_SEC
            if (end - start >= MIN_PAUSE_SEC) pauses.push({ start: round(start), end: round(end) })
            runStart = null
        }
    }
    return { speechStartSec: round(first * FRAME_SEC), pauses }
}

function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)
    const write = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))

    write(0, "RIFF")
    view.setUint32(4, 36 + samples.length * 2, true)
    write(8, "WAVE")
    write(12, "fmt ")
    view.setUint32(16, 16, true)          // PCM chunk size
    view.setUint16(20, 1, true)           // PCM format
    view.setUint16(22, 1, true)           // mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    write(36, "data")
    view.setUint32(40, samples.length * 2, true)

    samples.forEach((s, i) => {
        const clamped = Math.max(-1, Math.min(1, s))
        view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    })
    return new Blob([view], { type: "audio/wav" })
}

/** Reads a question aloud with the browser's text-to-speech. */
export function speak(text, onEnd) {
    if (!("speechSynthesis" in window)) { onEnd?.(); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith("en") && /natural|google|samantha|aria/i.test(v.name))
        || window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith("en"))
    if (voice) utterance.voice = voice
    utterance.rate = 1
    utterance.onend = () => onEnd?.()
    utterance.onerror = () => onEnd?.()
    window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel()
}

function round(n) {
    return Math.round(n * 100) / 100
}
