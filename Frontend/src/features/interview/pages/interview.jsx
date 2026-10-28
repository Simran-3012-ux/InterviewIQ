import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import "../../../style/interview.scss"
import {useInterview} from '../hooks/useInterview.js'
import { SparkleIcon } from '../components/Icons'

// UI layer only. The real report will come from a hook later (fetched by :interviewId).
// Shape matches the backend interviewReport model.


const SECTIONS = [
    { key: "technical", label: "Technical questions" },
    { key: "behavioral", label: "Behavioral questions" },
    { key: "roadmap", label: "Road Map" },
]

const QuestionList = ({ items }) => {
    const [openIndex, setOpenIndex] = useState(0)

    if (!items.length) return <p className="empty">No questions yet.</p>

    return (
        <ul className="question-list">
            {items.map((item, i) => {
                const isOpen = openIndex === i
                return (
                    <li key={i} className={`question-card ${isOpen ? 'open' : ''}`}>
                        <button
                            type="button"
                            className="question-head"
                            onClick={() => setOpenIndex(isOpen ? null : i)}
                            aria-expanded={isOpen}
                        >
                            <span className="question-number">Q{i + 1}</span>
                            <span className="question-text">
                                {item.question}
                                {item.source === "question_bank" && <span className="source-badge">From question bank</span>}
                            </span>
                            <span className="question-toggle">{isOpen ? '−' : '+'}</span>
                        </button>
                        {isOpen && (
                            <div className="question-body">
                                <div className="question-block">
                                    <h4>Intention</h4>
                                    <p>{item.intention}</p>
                                </div>
                                <div className="question-block">
                                    <h4>How to answer</h4>
                                    <p>{item.answer}</p>
                                </div>
                            </div>
                        )}
                    </li>
                )
            })}
        </ul>
    )
}

const RoadMap = ({ plan }) => {
    if (!plan.length) return <p className="empty">No plan yet.</p>

    return (
        <ol className="roadmap">
            {plan.map(({ day, focus, tasks }) => (
                <li key={day} className="roadmap-day">
                    <span className="roadmap-dot" />
                    <div className="roadmap-content">
                        <span className="roadmap-label">Day {day}</span>
                        <h4>{focus}</h4>
                        <ul>
                            {tasks.map((task, i) => <li key={i}>{task}</li>)}
                        </ul>
                    </div>
                </li>
            ))}
        </ol>
    )
}

const Interview = () => {
    
    const [active, setActive] = useState("technical")
    const {report, loading, getReportById, getResumePdf} = useInterview()
    const {interviewId} = useParams()
    const navigate = useNavigate()
    const [downloading, setDownloading] = useState(false)
    const [downloadError, setDownloadError] = useState("")

    const handleDownloadResume = async () => {
        setDownloading(true)
        setDownloadError("")
        try{
            await getResumePdf(report._id)
        }catch(error){
            setDownloadError(error.message)
        }finally{
            setDownloading(false)
        }
    }

    // Load the report from the backend if it isn't already in memory (e.g. after a page refresh)
    useEffect(() => {
        if(interviewId && report?._id !== interviewId){
            getReportById(interviewId)
        }
    }, [interviewId])

    if(loading || !report){
        return (
            <main className='loading-screen'>
                <h1>{loading ? "Loading your interview plan....." : "Report not found."}</h1>
            </main>
        )
    }

    const activeLabel = SECTIONS.find((s) => s.key === active).label

    return (
        <main className="interview">
            <div className="interview-board">

                {/* Left: section nav */}
                <aside className="interview-nav">
                    <div className="match-score">
                        <span className="match-score-value">{report.matchScore}%</span>
                        <span className="match-score-label">Match score</span>
                    </div>
                    <nav className="nav-list">
                        {SECTIONS.map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                className={`nav-item ${active === key ? 'active' : ''}`}
                                onClick={() => setActive(key)}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>

                    {/* pinned to the bottom of the nav */}
                    <div className="nav-footer">
                        <button
                            type="button"
                            className="mock-interview-btn"
                            onClick={() => navigate(`/interview/${report._id}/mock`)}
                        >
                            Start voice mock interview
                        </button>
                        <button
                            type="button"
                            className="download-resume-btn"
                            onClick={handleDownloadResume}
                            disabled={downloading}
                        >
                            <SparkleIcon size={16} className={downloading ? "spin" : ""} />
                            <span>{downloading ? "Generating resume..." : "Download AI generated resume"}</span>
                        </button>
                        {downloadError && <p className="download-error">{downloadError}</p>}
                    </div>
                </aside>

                {/* Middle: main content */}
                <section className="interview-main">
                    <h2 className="main-title">{activeLabel}</h2>
                    {active === "technical" && <QuestionList key="technical" items={report.technicalQuestions} />}
                    {active === "behavioral" && <QuestionList key="behavioral" items={report.behavorialQuestions} />}
                    {active === "roadmap" && <RoadMap plan={report.preparationPlan} />}
                </section>

                {/* Right: skill gaps */}
                <aside className="interview-gaps">
                    <h3 className="gaps-title">Skill Gaps</h3>
                    <div className="gap-list">
                        {report.skillGaps.map(({ skill, severity }) => (
                            <span key={skill} className={`gap-chip ${severity}`} title={`${severity} severity`}>
                                {skill}
                            </span>
                        ))}
                    </div>

                    {report.referenceQuestions?.length > 0 && (
                        <div className="reference-questions">
                            <h3 className="gaps-title">Grounded in real questions</h3>
                            <p className="reference-note">
                                Retrieved from the question bank by vector search and given to the AI as context.
                            </p>
                            <ul>
                                {report.referenceQuestions.slice(0, 6).map((q) => (
                                    <li key={q.question}>
                                        {q.question}
                                        <span>{q.topic}{q.company && q.company !== "unspecified" ? ` · ${q.company}` : ""}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </aside>
            </div>
        </main>
    )
}

export default Interview
