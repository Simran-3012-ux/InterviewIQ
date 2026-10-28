# InterviewIQ

**AI-Powered Interview Preparation and Resume Tailoring Platform**

InterviewIQ is a full-stack web application that helps candidates prepare for job interviews. Given a resume, a self-description and a target job description, it generates a personalized interview report containing a profile match score, likely technical and behavioral questions with guidance on how to answer them, an analysis of skill gaps, and a day-wise preparation plan. It can also produce an ATS-friendly resume tailored to the specific role.

Beyond the report, InterviewIQ runs a **voice mock interview** conducted by an adaptive AI interviewer. Answers are transcribed, analysed for delivery and graded against a fixed rubric, and a committee of three AI reviewers debates the interview and votes on a hiring decision.

**Technologies:** React 19, Vite, Node.js, Express 5, MongoDB Atlas (Vector Search), Google Gemini (text, audio and embeddings), Web Audio API, JWT

**AI concepts applied:** retrieval-augmented generation (RAG), vector search, chunking and grounding; speech-to-text and audio processing; agents with conversation memory and adaptive difficulty; LLM-as-a-judge with measured agreement against human grading; multi-agent systems with role prompting and vote aggregation.

---

## Screenshots

<p align="center">
  <img src="docs/screenshots/home.png" alt="InterviewIQ home page showing job description, resume upload, self description and recent interview plans" width="900" />
  <br/><em>Home page: job description input, resume upload, self description and previously generated interview plans</em>
</p>

<p align="center">
  <img src="docs/screenshots/report.png" alt="InterviewIQ report page showing match score, technical questions and skill gaps" width="900" />
  <br/><em>Interview report: match score, expandable questions with interviewer intention and suggested answers, and skill gaps by severity</em>
</p>

## Overview

Candidates preparing for an interview typically face two questions: what they are likely to be asked, and whether their resume suits the role. Answering these usually involves searching through generic question lists and manually rewriting the resume for each application.

InterviewIQ addresses both in a single workflow. The application extracts text from the uploaded resume (PDF), combines it with the self-description and the job description, retrieves the most relevant real interview questions from a vector-indexed question bank, and sends everything to Google Gemini with a strict JSON schema defined using Zod. The structured response is stored in MongoDB against the user's account and presented in a dashboard. On request, the application generates a tailored resume and returns it as a PDF.

The candidate can then practise in a voice mock interview. The AI interviewer asks questions aloud, adapts its follow-up questions and difficulty to each answer, and provides feedback on both content and delivery. At the end, a hiring committee of three AI reviewers delivers a decision supported by quotes from the candidate's own answers.

Key characteristics:

- **Role-specific output.** Questions, skill gaps and preparation tasks are derived from the candidate's own resume and the given job description rather than generic lists.
- **Explanatory guidance.** Each question includes the interviewer's intention, helping the candidate understand what is being assessed.
- **Reliable AI responses.** Schema-constrained generation ensures the frontend always receives well-formed, predictable data.
- **Grounded in real questions.** Retrieval from a question bank reduces invented questions and makes the source of each question visible.
- **Realistic practice.** Spoken answers, adaptive follow-ups and measurable delivery feedback reflect how real interviews are conducted.
- **End-to-end workflow.** Analysis, preparation, practice and resume tailoring are available in one place.

## Features

- **Authentication:** user registration and login with bcrypt password hashing, JWT stored in an HTTP-only cookie, and token blacklisting on logout.
- **Resume parsing:** PDF upload (up to 3 MB) with server-side text extraction using `pdf-parse`.
- **Match score:** a score from 0 to 100 indicating how closely the candidate's profile fits the job description.
- **Technical questions:** role-specific questions, each with the interviewer's intention and a suggested approach to answering.
- **Behavioral questions:** questions with intention and structured (STAR-based) answer guidance.
- **Skill gap analysis:** missing or weak skills classified by severity (low, medium, high).
- **Preparation plan:** a day-wise schedule with focus areas and tasks.
- **Tailored resume generation:** the resume is rewritten for the target role and exported as an A4 PDF using Puppeteer.
- **Report history:** all generated reports are saved to the user's account for later reference.
- **Grounded questions (RAG):** report questions are grounded in a bank of real interview questions retrieved by vector search; questions taken from the bank are labelled in the interface.
- **Voice mock interview:** the AI interviewer speaks each question and the candidate answers by voice (or by typing).
- **Delivery analysis:** filler words, speaking pace, long pauses, response latency and time taken to reach the main point.
- **Adaptive interviewer agent:** follow-up and clarification questions, with difficulty adjusted to the candidate's performance.
- **Rubric grading:** every answer is scored for correctness, depth, structure and STAR format.
- **Hiring committee:** three AI reviewers (Tech Lead, HR Partner, Bar Raiser) review the transcript, debate and vote.

## AI Features in Detail

This section explains how each advanced feature works and where it is implemented.

### 1. Retrieval-Augmented Generation over Real Interview Questions

A question bank is stored in MongoDB with a 768-dimensional Gemini embedding for every question. When a report is generated, the job description is split into overlapping word chunks, each chunk is embedded, and MongoDB Atlas Vector Search returns the closest questions. The best matches are passed to Gemini as reference context, and Gemini is instructed to use or adapt them first and to mark each question as `question_bank` or `generated`. The retrieved questions are stored with the report so the grounding is visible in the interface. If the vector index is unavailable (for example on a local MongoDB), the service falls back to in-memory cosine similarity.

| Purpose | File |
|---|---|
| Question bank schema (with embedding field) | `Backend/src/models/questionBank.model.js` |
| Chunking, vector search and fallback | `Backend/src/services/rag.service.js` |
| Grounded report prompt | `Backend/src/services/ai.service.js` |
| Embedding and loading questions from CSV | `Backend/scripts/seedQuestionBank.js` |
| Creating the Atlas Vector Search index | `Backend/scripts/createVectorIndex.js` |
| Question data | `Backend/data/question_bank.csv` |

The repository includes a starter set of 153 commonly asked questions tagged by role, topic and difficulty (marked `curated-common`, with no company attribution). Additional real questions, tagged by company, can be appended to the CSV in the same format and loaded with `npm run seed:questions`; already-embedded questions are skipped.

### 2. Voice Mock Interview with Speech Analysis

The interviewer reads each question aloud using the browser's speech synthesis. The answer is recorded in the browser, resampled to 16 kHz mono WAV, and analysed with the Web Audio API to find when speech begins and where silent pauses occur (frame energy with a threshold adapted to background noise). On the server, Gemini transcribes the audio verbatim, keeping filler words. The server then computes words per minute over actual speaking time, filler word counts and rate, long pauses (two seconds or more), response latency, and the time taken to reach the main point (the grader identifies the first words that directly answer the question, which are located in the transcript and converted into seconds).

| Purpose | File |
|---|---|
| Recording, WAV encoding, pause detection, text-to-speech | `Frontend/src/features/mock/utils/audio.js` |
| Transcription and delivery metrics | `Backend/src/services/speech.service.js` |
| Interview interface | `Frontend/src/features/mock/pages/MockInterview.jsx` |

### 3. Adaptive Interviewer Agent

After every answer, an agent reads the complete conversation (stored in the session as its memory), the scores so far, the current difficulty and the pool of unused questions, and chooses one action: `follow_up` to dig deeper, `clarify` when an answer is vague, `next_question`, or `end_interview`. It raises the difficulty when the candidate performs well and lowers it when they struggle. Deterministic guard rails limit follow-ups to two per topic, move difficulty by at most one level per turn, validate the chosen question and guarantee that the interview ends. The question pool combines the report's questions with questions retrieved from the bank.

| Purpose | File |
|---|---|
| Agent decision and guard rails | `Backend/src/services/interviewer.agent.js` |
| Session, turns and conversation memory | `Backend/src/models/mockSession.model.js` |
| Interview flow | `Backend/src/controllers/mock.controller.js` |

### 4. Rubric-Based Grading with Measured Agreement

Each answer is graded by Gemini acting as a judge, at temperature 0, against a fixed rubric with explicit anchors for every score from 1 to 5 on correctness, depth, structure and (for behavioral questions) STAR format. The rubric carries a version number. To measure the grader's reliability, answers from mock interviews are exported to a spreadsheet, graded by hand, and compared with the AI grades. The evaluation reports exact agreement, agreement within one point, mean absolute error and quadratic weighted Cohen's kappa for each criterion, and appends the result to a history file so that each rubric or prompt revision can be compared with the previous one.

| Purpose | File |
|---|---|
| Rubric and grader | `Backend/src/services/grader.service.js` |
| Export answers for hand grading | `Backend/scripts/exportAnswers.js` |
| Agreement evaluation | `Backend/scripts/evaluateGrader.js` |
| Hand grades and results | `Backend/eval/hand_grades.csv`, `Backend/eval/results/` |

Workflow: complete several mock interviews, run `npm run export:answers`, fill in the `human_*` columns for at least 50 answers in `eval/hand_grades.csv`, then run `npm run eval:grader`.

### 5. Hiring Committee of AI Agents

When the interview ends, three agents with distinct roles review the transcript, including delivery metrics. The Tech Lead focuses on technical depth, the HR Partner on communication, ownership and delivery, and the Bar Raiser on long-term potential and red flags. In the first round each reviews independently and in parallel, so that no agent anchors on another, and votes with a confidence level, citing the candidate's exact words. In the second round each agent reads the others' reviews, responds to them by name and may change its vote. The final decision is a confidence-weighted vote in which a strong no-hire from the Bar Raiser acts as a veto. Every quoted piece of evidence is checked against the transcript and marked as verified or not.

| Purpose | File |
|---|---|
| Committee rounds, aggregation and citation checks | `Backend/src/services/committee.service.js` |
| Results page | `Frontend/src/features/mock/pages/MockResult.jsx` |

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, React Router, Context API with custom hooks, Axios, SCSS |
| Backend | Node.js, Express 5, Multer, pdf-parse, Puppeteer |
| AI | Google Gemini (`@google/genai`): structured JSON output via Zod schemas, audio transcription, `gemini-embedding-001` embeddings |
| Audio | MediaRecorder, Web Audio API, Speech Synthesis API |
| Database | MongoDB Atlas with Mongoose and Atlas Vector Search |
| Authentication and Security | JWT, bcryptjs, HTTP-only cookies, token blacklist, CORS |

## Architecture

```
+----------------------+   Axios (cookies)   +--------------------------------+
|  React + Vite        | ------------------> |  Express REST API              |
|  Web Audio API,      | <------------------ |  auth, reports, mock interview |
|  speech synthesis    |   JSON / PDF / WAV  |  agent, grader, committee      |
+----------------------+                     +---------------+----------------+
                                                             |
                     +---------------------------------------+-------------------------------+
                     |                                       |                               |
         +-----------------------+            +---------------------------+       +------------------+
         |    MongoDB Atlas      |            |       Google Gemini       |       |    Puppeteer     |
         | users, reports,       |            | JSON generation (Zod),    |       |   HTML to PDF    |
         | mock sessions,        |            | audio transcription,      |       +------------------+
         | question bank +       |            | embeddings                |
         | Vector Search index   |            +---------------------------+
         +-----------------------+
```

**Report generation flow:** resume PDF, text extraction, retrieval of similar real questions by vector search, prompt with reference questions and Zod JSON schema, Gemini, validated JSON, storage in MongoDB, display in the dashboard.

**Mock interview flow (per answer):** browser recording, WAV conversion and pause detection, Gemini transcription, delivery metrics, rubric grading, agent decision on the next question. At the end, the hiring committee reviews the full transcript.

## Project Structure

```
InterviewIQ/
├── render.yaml                    # Render deployment blueprint
├── docs/screenshots/              # Images used in this README
├── Backend/
│   ├── server.js                  # Entry point
│   ├── data/                      # Question bank (CSV)
│   ├── eval/                      # Hand grades and grader evaluation results
│   ├── scripts/                   # Seeding, vector index, export and evaluation scripts
│   └── src/
│       ├── app.js                 # Express app, middleware and routes
│       ├── config/database.js     # MongoDB connection
│       ├── controllers/           # Authentication, interview and mock interview logic
│       ├── middlewares/           # JWT authentication, file upload (Multer)
│       ├── models/                # User, InterviewReport, QuestionBank, MockSession, Blacklist
│       ├── routes/                # /api/auth, /api/interview, /api/mock
│       └── services/              # Gemini client, RAG, speech, grader, agent, committee
└── Frontend/
    └── src/
        ├── app.routes.jsx         # Route definitions
        ├── features/
        │   ├── auth/              # Login, Register, protected routes, context
        │   ├── interview/         # Home (input form), report page, context
        │   └── mock/              # Voice mock interview, results, audio utilities
        └── style/                 # SCSS styles
```

## API Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a new user |
| POST | `/api/auth/login` | Public | Log in and receive a JWT cookie |
| GET | `/api/auth/logout` | Public | Clear the cookie and blacklist the token |
| GET | `/api/auth/get-me` | Private | Retrieve the logged-in user |
| POST | `/api/interview/` | Private | Generate a report (`multipart/form-data`: `resume`, `jobDescription`, `selfDescription`) |
| GET | `/api/interview/` | Private | List all reports of the user |
| GET | `/api/interview/report/:interviewId` | Private | Retrieve a single report |
| GET / POST | `/api/interview/resume/pdf/:interviewReportId` | Private | Download the tailored resume as a PDF |
| POST | `/api/mock/start/:reportId` | Private | Start a mock interview for a report |
| POST | `/api/mock/session/:sessionId/answer` | Private | Submit an answer (`multipart/form-data`: `audio` WAV with `durationSec`, `speechStartSec`, `pauses`, or `text`) |
| POST | `/api/mock/session/:sessionId/finish` | Private | End the interview and run the hiring committee |
| GET | `/api/mock/session/:sessionId` | Private | Retrieve a mock interview with all turns and the decision |
| GET | `/api/mock/report/:reportId` | Private | List mock interviews for a report |

## Getting Started

### Prerequisites

- Node.js 18 or later
- A MongoDB database (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A Google Gemini API key ([Google AI Studio](https://aistudio.google.com/))

### 1. Clone the repository

```bash
git clone https://github.com/Simran-3012-ux/InterviewIQ.git
cd InterviewIQ
```

### 2. Set up the backend

```bash
cd Backend
npm install
cp .env.example .env    # then fill in the values
npm run dev             # runs on http://localhost:3000
```

Environment variables (`Backend/.env`):

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWTs |
| `GEMINI_API_KEY` | Google Gemini API key |

### 3. Build the question bank

```bash
npm run seed:questions        # embed data/question_bank.csv and store it in MongoDB
npm run create:vector-index   # create the Atlas Vector Search index (Atlas only)
```

On the Gemini free tier, embedding is limited to 100 requests per minute; the scripts wait and retry automatically.

### 4. Set up the frontend

```bash
cd ../Frontend
npm install
npm run dev             # runs on http://localhost:5173
```

Open http://localhost:5173, create an account and generate an interview report. From the report page, select "Start voice mock interview". Voice answers require microphone permission; a typed mode is also available.

### Backend scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the API with automatic reload |
| `npm run seed:questions` | Embed and load questions from a CSV file (default `data/question_bank.csv`) |
| `npm run create:vector-index` | Create the Atlas Vector Search index |
| `npm run export:answers` | Export mock interview answers for hand grading |
| `npm run eval:grader` | Measure AI grading agreement with hand grades |

## Deployment

The application is deployed as a single web service: in production, the Express server serves the API under `/api` and the built React application for all other routes. Because the frontend and API share one origin, the authentication cookie works without cross-site configuration.

The repository contains a [Render](https://render.com) Blueprint (`render.yaml`) that builds both parts and starts the server.

1. In MongoDB Atlas, open **Network Access** and allow access from anywhere (`0.0.0.0/0`), since Render does not use fixed IP addresses.
2. In Render, select **New > Blueprint**, connect the GitHub repository and choose `render.yaml`.
3. Enter the values for `MONGO_URI` and `GEMINI_API_KEY` when prompted. `JWT_SECRET` is generated automatically.
4. After the first deploy, open the service URL. The health check is available at `/api/health`.

| Environment variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `GEMINI_API_KEY` | Google Gemini API key |
| `JWT_SECRET` | Secret used to sign JWTs |
| `NODE_ENV` | Set to `production` (enables secure cookies) |
| `CLIENT_ORIGIN` | Optional: allowed origins for CORS when the frontend is hosted separately |
| `VITE_API_URL` | Optional, frontend build time: API base URL when the frontend is hosted separately |

On the free plan the service sleeps after a period of inactivity, so the first request afterwards can take up to a minute.

## Security

- Passwords are hashed with bcrypt and never stored in plain text.
- JWTs are stored in an HTTP-only, SameSite=Lax cookie (marked Secure in production), with an `Authorization: Bearer` header supported for API clients.
- Tokens are blacklisted in MongoDB on logout to prevent reuse.
- Reports are always queried by owner, so users can access only their own data.
- File uploads are limited to 3 MB, and secrets are kept in a git-ignored `.env` file.

## Future Enhancements

- Expand the question bank with company-tagged questions collected from interview experiences
- Shareable report links and PDF export of the complete report
- Unit and integration tests
- Rate limiting on login and on AI endpoints

## Author

**Simran Maurya**
