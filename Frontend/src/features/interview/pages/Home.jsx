import React, { useState, useRef, useEffect } from 'react'
import "../../../style/home.scss"
import {useInterview} from '../hooks/useInterview.js'
import {useNavigate} from 'react-router-dom'
import {
    SparkleIcon, ClockIcon, SettingsIcon, BriefcaseIcon, FileIcon,
    UserIcon, InfoIcon, StarIcon, UploadIcon, ChevronRightIcon, LockIcon,
} from '../components/Icons'

// UI layer only. Data fetching / report generation will come from a hook later.

const SAMPLE_JOBS = {
    "Senior Frontend": "We are hiring a Senior Frontend Engineer with 5+ years of experience in React, TypeScript and modern CSS. You will own UI architecture, mentor engineers and work closely with design.",
    "Product Manager": "Looking for a Product Manager to define roadmap, gather customer insights, write clear specs and lead cross-functional teams to ship impactful features.",
    "Data Scientist": "Seeking a Data Scientist skilled in Python, SQL, statistics and machine learning to build predictive models and turn data into business decisions.",
}

const SELF_PROMPTS = [
    { label: "Key achievements", text: "Key achievements: " },
    { label: "Career gap context", text: "Career gap context: " },
    { label: "Target compensation", text: "Target compensation: " },
]

const countWords = (text) => text.trim() ? text.trim().split(/\s+/).length : 0

const Home = () => {
    const{loading,generateReport,reports,getReports} = useInterview()
    const [jobDescription, setJobDescription] = useState('')
    const [selfDescription, setSelfDescription] = useState('')
    const [resume, setResume] = useState(null)
    const resumeInputRef = useRef()

    const navigate = useNavigate()

    // Load the user's past reports once when the page opens
    useEffect(() => {
        getReports()
    }, [])

    const handleGenerateReport = async() =>{
        const resumeFile = resumeInputRef.current?.files[0] || resume
        if(!resumeFile){
            alert("Please upload your resume first.")
            return
        }
        try{
            const data = await generateReport({ jobDescription, selfDescription, resumeFile})
            if(data?._id){
                navigate(`/interview/${data._id}`)
            }
        }catch(error){
            alert(`Could not generate report: ${error.message}`)
        }
    }
    
    if(loading) {
        return(
            <main className='loading-screen'>
                <h1>Loading your interview plan.....</h1>
            </main>
        )
        
    }

    const addSelfPrompt = (text) => {
        setSelfDescription((prev) => (prev ? `${prev}\n${text}` : text))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        handleGenerateReport()
    }

    
    

    return (
        <main className='home'>
            <form className="home-card" onSubmit={handleSubmit}>

                {/* Top bar */}
                <header className="topbar">
                    <div className="brand">
                        <span className="brand-logo"><SparkleIcon size={20} /></span>
                        <span className="brand-name">InterviewIQ</span>
                        <span className="brand-badge">PRO</span>
                    </div>
                    <div className="topbar-actions">
                        <button type="button" className="icon-button" aria-label="History"><ClockIcon /></button>
                        <button type="button" className="icon-button" aria-label="Settings"><SettingsIcon /></button>
                    </div>
                </header>

                <div className="home-content">
                    {/* Hero */}
                    <section className="hero">
                        <h1>Interview Intelligence</h1>
                        <p>Tailor your resume, uncover gaps &amp; prepare high-impact interview questions.</p>
                    </section>

                    <div className="home-grid">
                    {/* Left column: job description */}
                    <section className="field field-grow col-left">
                        <div className="field-header">
                            <label htmlFor="jobDescription" className="field-title">
                                <BriefcaseIcon /> Job Description
                            </label>
                            <button type="button" className="link-button" onClick={() => setJobDescription('')}>Clear</button>
                        </div>

                        <div className="samples">
                            <span className="samples-label">Samples:</span>
                            {Object.keys(SAMPLE_JOBS).map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    className="chip"
                                    onClick={() => setJobDescription(SAMPLE_JOBS[name])}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>

                        <div className="textarea-box dark">
                            <textarea
                                name="jobDescription"
                                id="jobDescription"
                                placeholder='Enter job description here....'
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                            />
                            <div className="textarea-footer">
                                <span><InfoIcon size={14} /> Skills &amp; responsibilities extracted via AI</span>
                                <span className="word-count">{countWords(jobDescription)} words</span>
                            </div>
                        </div>
                    </section>

                    {/* Right column */}
                    <div className="col-right">
                    {/* Resume */}
                    <section className="field">
                        <div className="field-header">
                            <span className="field-title"><FileIcon /> Resume</span>
                            <span className="badge-success">Recommended</span>
                        </div>

                        <div className="tip">
                            <StarIcon size={16} />
                            <p><strong>Pro tip:</strong> Use Resume and self description together for best results.</p>
                        </div>

                        <label className='upload-card' htmlFor="resume">
                            <span className="upload-icon"><UploadIcon size={22} /></span>
                            <span className="upload-text">
                                <strong>{resume ? resume.name : 'Upload Resume'}</strong>
                                <small>PDF, DOCX, or RTF (max 10MB)</small>
                            </span>
                            <span className="upload-arrow"><ChevronRightIcon /></span>
                        </label>
                        <input
                            ref = {resumeInputRef}
                            hidden
                            type="file"
                            name="resume"
                            id="resume"
                            accept=".pdf,.docx,.rtf"
                            onChange={(e) => setResume(e.target.files[0] || null)}
                        />
                    </section>

                    {/* Self description */}
                    <section className="field">
                        <div className="field-header">
                            <label htmlFor="selfDescription" className="field-title">
                                <UserIcon /> Self Description
                            </label>
                            <span className="optional">Optional</span>
                        </div>

                        <div className="samples">
                            {SELF_PROMPTS.map(({ label, text }) => (
                                <button key={label} type="button" className="chip" onClick={() => addSelfPrompt(text)}>
                                    + {label}
                                </button>
                            ))}
                        </div>

                        <div className="textarea-box light">
                            <textarea
                                name="selfDescription"
                                id="selfDescription"
                                placeholder="Highlight key achievements, work philosophy, career gaps, or focus areas not covered in resume..."
                                value={selfDescription}
                                onChange={(e) => setSelfDescription(e.target.value)}
                            />
                        </div>
                    </section>

                    {/* Recent reports list*/}
                    {reports.length > 0 && (
                        <section className='recent-reports'>
                            <h2>My recent Interview Plans</h2>
                            <ul className='reports-list'>
                                {reports.map(report=>(
                                    <li key={report._id} className='report-item' onClick={()=> navigate(`/interview/${report._id}`)}>
                                    <h3>{report.title || 'Untitled Position'}</h3>
                                    <p className='report-meta'>Generated on {new Date(report.createdAt).toLocaleDateString()}</p>
                                    <p className='match-score'>Match Score: {report.matchScore ?? 0}%</p>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                    </div>
                    </div>
                </div>

                {/* Footer CTA */}
                <footer className="home-footer">
                    <button type="submit" className='generate-button'>
                        <SparkleIcon size={20} /> Generate Interview Report
                    </button>
                    <p className="secure-note"><LockIcon size={12} /> Encrypted &amp; securely analyzed with private LLM</p>
                </footer>
            </form>
        </main>
    )
}

export default Home
