import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import "../../../style/mock.scss"
import { useInterview } from "../../interview/hooks/useInterview.js"
import { startMockInterview, submitAnswer, finishMockInterview, getMockSessionsForReport, errorMessage } from "../services/mock.api"
import { startRecording, processRecording, speak, stopSpeaking } from "../utils/audio"
import { SparkleIcon } from "../../interview/components/Icons"

const KIND_LABEL = { main: "Main question", follow_up: "Follow-up", clarify: "Clarification" }
const ORIGIN_LABEL = { report: "From your report", question_bank: "From question bank", agent: "Asked by the AI interviewer" }
const ACTION_LABEL = {
    follow_up: "Digging deeper",
    clarify: "Asking for clarification",
    next_question: "Moving to the next question",
    end_interview: "Interview complete",
}

const Difficulty = ({ level }) => (
    <div className="difficulty" title={`Difficulty ${level} of 5`}>
        <span className="difficulty-label">Difficulty</span>
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`difficulty-dot ${n <= level ? "on" : ""}`} />)}
    </div>
)

const Feedback = ({ turn }) => {
    const { grade, speech, agentDecision } = turn
    return (
        <div className="feedback">
            <div className="feedback-scores">
                <Score label="Correctness" value={grade.correctness} />
                <Score label="Depth" value={grade.depth} />
                <Score label="Structure" value={grade.structure} />
                {grade.star !== null && grade.star !== undefined && <Score label="STAR" value={grade.star} />}
                <Score label="Overall" value={grade.overall} highlight />
            </div>

            {speech && (
                <div className="feedback-speech">
                    {speech.wordsPerMinute ? <span>{speech.wordsPerMinute} words/min</span> : null}
                    <span>{speech.fillerCount} filler words</span>
                    {speech.longPauses?.length ? <span>{speech.longPauses.length} long pause(s), longest {speech.longestPauseSec}s</span> : null}
                    {speech.timeToPointSec !== null && speech.timeToPointSec !== undefined && <span>Reached the point in {speech.timeToPointSec}s</span>}
                </div>
            )}

            {grade.improvements?.length > 0 && (
                <ul className="feedback-list">
                    {grade.improvements.map((tip, i) => <li key={i}>{tip}</li>)}
                </ul>
            )}

            {agentDecision && (
                <p className="agent-note">
                    <strong>{ACTION_LABEL[agentDecision.action]}:</strong> {agentDecision.reasoning}
                </p>
            )}
        </div>
    )
}

const Score = ({ label, value, highlight }) => (
    <div className={`score ${highlight ? "highlight" : ""}`}>
        <span className="score-value">{value}</span>
        <span className="score-label">{label}</span>
    </div>
)

const MockInterview = () => {
    const { interviewId } = useParams()
    const navigate = useNavigate()
    const { report, getReportById } = useInterview()

    const [phase, setPhase] = useState("setup")          // setup | live | finishing
    const voiceSupported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && "MediaRecorder" in window
    const [mode, setMode] = useState(voiceSupported ? "voice" : "text")
    const [questionCount, setQuestionCount] = useState(4)
    const [pastSessions, setPastSessions] = useState([])

    const [session, setSession] = useState(null)
    const [question, setQuestion] = useState(null)
    const [difficulty, setDifficulty] = useState(3)
    const [lastTurn, setLastTurn] = useState(null)
    const [done, setDone] = useState(false)

    const [recording, setRecording] = useState(false)
    const [seconds, setSeconds] = useState(0)
    const [typed, setTyped] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    const recorderRef = useRef(null)
    const timerRef = useRef(null)

    useEffect(() => {
        if (interviewId && report?._id !== interviewId) getReportById(interviewId)
        getMockSessionsForReport(interviewId).then((d) => setPastSessions(d.sessions)).catch(() => {})
        return () => { stopSpeaking(); clearInterval(timerRef.current) }
    }, [interviewId])

    const askAloud = (q) => { if (mode === "voice" && q) speak(q.question) }

    const handleStart = async () => {
        setBusy(true); setError("")
        try {
            const data = await startMockInterview({ reportId: interviewId, maxMainQuestions: questionCount })
            setSession(data.session)
            setQuestion(data.session.currentQuestion)
            setDifficulty(data.session.difficulty)
            setPhase("live")
            askAloud(data.session.currentQuestion)
        } catch (e) {
            setError(errorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    const handleRecord = async () => {
        setError("")
        if (!recording) {
            try {
                stopSpeaking()
                recorderRef.current = await startRecording()
                setRecording(true)
                setSeconds(0)
                timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
            } catch {
                setError("Microphone access was blocked. Allow it in the browser, or switch to typing.")
            }
            return
        }
        clearInterval(timerRef.current)
        setRecording(false)
        const blob = await recorderRef.current.stop()
        setBusy(true)
        try {
            const { wav, durationSec, speechStartSec, pauses } = await processRecording(blob)
            await send({ audio: wav, durationSec, speechStartSec, pauses })
        } catch (e) {
            setError(errorMessage(e))
            setBusy(false)
        }
    }

    const handleTypedSubmit = async (e) => {
        e.preventDefault()
        if (!typed.trim()) return
        setBusy(true); setError("")
        try {
            await send({ text: typed })
            setTyped("")
        } catch (err) {
            setError(errorMessage(err))
            setBusy(false)
        }
    }

    const send = async (payload) => {
        const data = await submitAnswer({ sessionId: session._id, ...payload })
        setLastTurn(data.turn)
        setDifficulty(data.difficulty)
        setDone(data.done)
        setQuestion(data.nextQuestion)
        setBusy(false)
        askAloud(data.nextQuestion)
    }

    const handleFinish = async () => {
        stopSpeaking()
        setPhase("finishing"); setError("")
        try {
            await finishMockInterview(session._id)
            navigate(`/mock/${session._id}`)
        } catch (e) {
            setError(errorMessage(e))
            setPhase("live")
        }
    }

    if (phase === "finishing") {
        return (
            <main className="loading-screen">
                <h1>The hiring committee is reviewing your interview.....</h1>
            </main>
        )
    }

    return (
        <main className="mock">
            <div className="mock-board">
                <header className="mock-header">
                    <Link to={`/interview/${interviewId}`} className="back-link">Back to report</Link>
                    <h1>Mock Interview{report?.title ? `: ${report.title}` : ""}</h1>
                    {phase === "live" && <Difficulty level={difficulty} />}
                </header>

                {phase === "setup" && (
                    <section className="setup">
                        <p className="lead">
                            The AI interviewer asks questions out loud and listens to your spoken answers. It adapts as you go:
                            it digs deeper when an answer is promising, asks for clarification when it is vague, and raises or lowers
                            the difficulty based on how you are doing. At the end, a hiring committee of three AI reviewers debates
                            your interview and votes.
                        </p>

                        <div className="setup-options">
                            <label>
                                Main questions
                                <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}>
                                    {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </label>
                            <div className="mode-toggle">
                                <button type="button" className={mode === "voice" ? "active" : ""} disabled={!voiceSupported} onClick={() => setMode("voice")}>Voice</button>
                                <button type="button" className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}>Type</button>
                            </div>
                        </div>

                        <button type="button" className="primary-btn" onClick={handleStart} disabled={busy}>
                            <SparkleIcon size={18} /> {busy ? "Preparing questions..." : "Start mock interview"}
                        </button>
                        {error && <p className="error">{error}</p>}

                        {pastSessions.length > 0 && (
                            <div className="past">
                                <h2>Previous mock interviews</h2>
                                <ul>
                                    {pastSessions.map((s) => (
                                        <li key={s._id}>
                                            <Link to={`/mock/${s._id}`}>
                                                {new Date(s.createdAt).toLocaleString()}
                                                <span className={`verdict ${s.committee?.decision || "pending"}`}>
                                                    {s.committee?.decision ? s.committee.decision.replace("_", " ") : "not finished"}
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>
                )}

                {phase === "live" && (
                    <section className="live">
                        {question ? (
                            <div className="question-panel">
                                <div className="question-tags">
                                    <span className="tag">{KIND_LABEL[question.kind]}</span>
                                    <span className="tag subtle">{question.questionType}</span>
                                    <span className="tag subtle">{ORIGIN_LABEL[question.origin] || question.origin}</span>
                                </div>
                                <h2 className="question">{question.question}</h2>
                                {mode === "voice" && (
                                    <button type="button" className="link-btn" onClick={() => speak(question.question)}>Repeat question</button>
                                )}

                                {mode === "voice" ? (
                                    <div className="recorder">
                                        <button type="button" className={`record-btn ${recording ? "recording" : ""}`} onClick={handleRecord} disabled={busy}>
                                            {recording ? `Stop and submit (${seconds}s)` : busy ? "Evaluating..." : "Start answering"}
                                        </button>
                                        <p className="hint">{busy ? "Transcribing, grading and choosing the next question..." : "Speak naturally. Your pace, pauses and filler words are measured."}</p>
                                    </div>
                                ) : (
                                    <form className="typed" onSubmit={handleTypedSubmit}>
                                        <textarea value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your answer..." disabled={busy} />
                                        <button type="submit" className="primary-btn" disabled={busy || !typed.trim()}>
                                            {busy ? "Evaluating..." : "Submit answer"}
                                        </button>
                                    </form>
                                )}
                            </div>
                        ) : (
                            <div className="question-panel done">
                                <h2>All questions answered.</h2>
                                <p className="hint">Submit the interview to the hiring committee for a decision.</p>
                            </div>
                        )}

                        {error && <p className="error">{error}</p>}

                        {lastTurn && (
                            <div className="last-answer">
                                <h3>Feedback on your last answer</h3>
                                <p className="transcript">"{lastTurn.transcript}"</p>
                                <Feedback turn={lastTurn} />
                            </div>
                        )}

                        <div className="live-actions">
                            <button type="button" className={done ? "primary-btn" : "secondary-btn"} onClick={handleFinish} disabled={busy || recording || !lastTurn}>
                                {done ? "Get the hiring committee verdict" : "End interview and get verdict"}
                            </button>
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}

export default MockInterview
