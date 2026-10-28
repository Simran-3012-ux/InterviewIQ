import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import "../../../style/mock.scss"
import { getMockSession, errorMessage } from "../services/mock.api"

const VOTE_LABEL = { strong_hire: "Strong hire", hire: "Hire", no_hire: "No hire", strong_no_hire: "Strong no hire" }

const average = (values) => {
    const nums = values.filter((v) => typeof v === "number")
    return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null
}

const MockResult = () => {
    const { sessionId } = useParams()
    const [session, setSession] = useState(null)
    const [error, setError] = useState("")

    useEffect(() => {
        getMockSession(sessionId).then((d) => setSession(d.session)).catch((e) => setError(errorMessage(e)))
    }, [sessionId])

    if (error) return <main className="loading-screen"><h1>{error}</h1></main>
    if (!session) return <main className="loading-screen"><h1>Loading results.....</h1></main>

    const { turns, committee } = session
    const grades = turns.map((t) => t.grade || {})
    const voiceTurns = turns.filter((t) => t.answerMode === "voice" && t.speech)
    const summary = [
        ["Overall", average(grades.map((g) => g.overall))],
        ["Correctness", average(grades.map((g) => g.correctness))],
        ["Depth", average(grades.map((g) => g.depth))],
        ["Structure", average(grades.map((g) => g.structure))],
        ["STAR", average(grades.map((g) => g.star))],
    ].filter(([, v]) => v !== null)
    const speechSummary = voiceTurns.length ? [
        ["Words per minute", average(voiceTurns.map((t) => t.speech.wordsPerMinute))],
        ["Filler words per 100 words", average(voiceTurns.map((t) => t.speech.fillerRate))],
        ["Long pauses", voiceTurns.reduce((s, t) => s + (t.speech.longPauses?.length || 0), 0)],
        ["Seconds to reach the point", average(voiceTurns.map((t) => t.speech.timeToPointSec))],
    ].filter(([, v]) => v !== null) : []

    return (
        <main className="mock">
            <div className="mock-board">
                <header className="mock-header">
                    <Link to={`/interview/${session.report}`} className="back-link">Back to report</Link>
                    <h1>Mock Interview Results{session.title ? `: ${session.title}` : ""}</h1>
                </header>

                {committee?.decision && (
                    <section className={`verdict-banner ${committee.decision}`}>
                        <span className="verdict-title">Committee decision: {committee.decision === "hire" ? "Hire" : "No hire"}</span>
                        <span className="verdict-detail">{committee.rationale}</span>
                    </section>
                )}

                <section className="summary-grid">
                    {summary.map(([label, value]) => (
                        <div key={label} className="score"><span className="score-value">{value}</span><span className="score-label">{label} (of 5)</span></div>
                    ))}
                    {speechSummary.map(([label, value]) => (
                        <div key={label} className="score"><span className="score-value">{value}</span><span className="score-label">{label}</span></div>
                    ))}
                </section>

                {committee?.members?.length > 0 && (
                    <section>
                        <h2 className="section-title">Hiring committee</h2>
                        <div className="committee">
                            {committee.members.map((m) => (
                                <article key={m.role} className="member">
                                    <header>
                                        <h3>{m.role}</h3>
                                        <span className={`vote ${m.finalVote}`}>{VOTE_LABEL[m.finalVote]}</span>
                                    </header>
                                    <p className="vote-change">
                                        {m.changedVote
                                            ? `Changed vote after debate: ${VOTE_LABEL[m.initialVote]} to ${VOTE_LABEL[m.finalVote]}`
                                            : `Kept initial vote after debate`} · confidence {Math.round(m.confidence * 100)}%
                                    </p>
                                    <p>{m.summary}</p>

                                    <h4>Evidence from your answers</h4>
                                    <ul className="evidence">
                                        {m.evidence.map((e, i) => (
                                            <li key={i}>
                                                <q>{e.quote}</q>
                                                <span className={`verified ${e.verified ? "yes" : "no"}`}>{e.verified ? "quote verified" : "quote not found in transcript"}</span>
                                                <p>{e.assessment}</p>
                                            </li>
                                        ))}
                                    </ul>

                                    {m.concerns?.length > 0 && (
                                        <>
                                            <h4>Concerns</h4>
                                            <ul className="concerns">{m.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
                                        </>
                                    )}

                                    <h4>Debate</h4>
                                    <p className="rebuttal">{m.rebuttal}</p>
                                </article>
                            ))}
                        </div>
                    </section>
                )}

                <section>
                    <h2 className="section-title">Transcript and grades</h2>
                    <ol className="transcript-list">
                        {turns.map((t, i) => (
                            <li key={i} className="turn">
                                <div className="turn-head">
                                    <span className="tag">{t.kind.replace("_", " ")}</span>
                                    <span className="tag subtle">difficulty {t.difficulty}</span>
                                    {t.grade && <span className="tag subtle">overall {t.grade.overall}/5</span>}
                                </div>
                                <p className="turn-question">{t.question}</p>
                                <p className="transcript">"{t.transcript}"</p>
                                {t.grade && (
                                    <p className="turn-scores">
                                        Correctness {t.grade.correctness} · Depth {t.grade.depth} · Structure {t.grade.structure}
                                        {t.grade.star !== null && t.grade.star !== undefined ? ` · STAR ${t.grade.star}` : ""}
                                        {t.speech?.wordsPerMinute ? ` · ${t.speech.wordsPerMinute} wpm` : ""}
                                        {t.speech ? ` · ${t.speech.fillerCount} fillers` : ""}
                                    </p>
                                )}
                                {t.agentDecision && <p className="agent-note"><strong>Interviewer:</strong> {t.agentDecision.reasoning}</p>}
                            </li>
                        ))}
                    </ol>
                </section>
            </div>
        </main>
    )
}

export default MockResult
