<div align="center">

# 🎯 InterviewIQ

### AI-Powered Interview Preparation & Resume Tailoring Platform

Upload your resume, paste a job description, and get a personalized interview game plan in seconds — match score, likely questions with model answers, skill gaps, a day-by-day prep schedule, and an ATS-friendly resume tailored to the role.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?logo=googlegemini&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white)

</div>

---

## 📌 Overview

Preparing for an interview usually means guessing what will be asked and manually rewriting your resume for every job. **InterviewIQ** automates both. It reads your resume (PDF), your self-description, and the target job description, then uses **Google Gemini** with a strict, schema-validated JSON output to produce a structured interview report you can revisit anytime.

## ✨ Features

- 🔐 **Secure authentication** — register / login with hashed passwords (bcrypt), JWT stored in HTTP-only cookies, and token blacklisting on logout.
- 📄 **Resume PDF parsing** — upload a resume (up to 3 MB); text is extracted server-side with `pdf-parse`.
- 📊 **Match score (0–100)** — how well your profile fits the job description.
- 💻 **Technical questions** — role-specific questions, the interviewer's intention behind each, and how to answer.
- 🤝 **Behavioral questions** — with intention and STAR-style answer guidance.
- 🧩 **Skill-gap analysis** — missing skills ranked by severity (low / medium / high).
- 🗓️ **Day-wise preparation plan** — a focused task list for each day before the interview.
- 📝 **Tailored resume generator** — AI rewrites your resume for the role and exports it as a clean, ATS-friendly **A4 PDF** (rendered with Puppeteer).
- 🕘 **Report history** — every report is saved to your account so you can come back to it.

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, React Router, Context API + custom hooks, Axios, SCSS |
| **Backend** | Node.js, Express 5, Multer, pdf-parse, Puppeteer |
| **AI** | Google Gemini (`@google/genai`) with structured JSON output via Zod schemas |
| **Database** | MongoDB with Mongoose |
| **Auth & Security** | JWT, bcryptjs, HTTP-only cookies, token blacklist, CORS |

## 🏗️ Architecture

```
┌──────────────────┐   Axios (cookies)   ┌───────────────────────┐
│  React + Vite    │ ──────────────────► │  Express REST API     │
│  (Frontend)      │ ◄────────────────── │  (Backend)            │
└──────────────────┘        JSON / PDF   └──────────┬────────────┘
                                                    │
                      ┌─────────────────────────────┼─────────────────────────┐
                      ▼                             ▼                         ▼
              ┌───────────────┐          ┌────────────────────┐     ┌──────────────────┐
              │   MongoDB     │          │   Google Gemini    │     │    Puppeteer     │
              │ users,reports │          │ (Zod JSON schema)  │     │  HTML ➜ PDF      │
              └───────────────┘          └────────────────────┘     └──────────────────┘
```

**Report flow:** Resume PDF → text extraction → prompt + Zod JSON schema → Gemini → validated JSON → saved in MongoDB → rendered in the dashboard.

## 📁 Project Structure

```
InterviewIQ/
├── Backend/
│   ├── server.js                 # Entry point
│   └── src/
│       ├── app.js                # Express app, middleware, routes
│       ├── config/database.js    # MongoDB connection
│       ├── controllers/          # Auth & interview logic
│       ├── middlewares/          # JWT auth, file upload (Multer)
│       ├── models/               # User, InterviewReport, Blacklist
│       ├── routes/               # /api/auth, /api/interview
│       └── services/ai.service.js# Gemini prompts + PDF generation
└── Frontend/
    └── src/
        ├── app.routes.jsx        # Route definitions
        ├── features/
        │   ├── auth/             # Login, Register, Protected route, context
        │   └── interview/        # Home (input form), Report page, context
        └── style/                # SCSS styles
```

## 🔌 API Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a new user |
| POST | `/api/auth/login` | Public | Login and receive JWT cookie |
| GET | `/api/auth/logout` | Public | Clear cookie and blacklist token |
| GET | `/api/auth/get-me` | Private | Get the logged-in user |
| POST | `/api/interview/` | Private | Generate a report (`multipart/form-data`: `resume`, `jobDescription`, `selfDescription`) |
| GET | `/api/interview/` | Private | List all reports of the user |
| GET | `/api/interview/report/:interviewId` | Private | Get a single report |
| GET / POST | `/api/interview/resume/pdf/:interviewReportId` | Private | Download the tailored resume as PDF |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
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
cp .env.example .env    # then fill in your values
npm run dev             # runs on http://localhost:3000
```

**Environment variables (`Backend/.env`):**

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWTs |
| `GEMINI_API_KEY` | Google Gemini API key |

### 3. Set up the frontend

```bash
cd ../Frontend
npm install
npm run dev             # runs on http://localhost:5173
```

Open **http://localhost:5173**, create an account, and generate your first interview report.

## 🔒 Security Highlights

- Passwords hashed with **bcrypt**; never stored in plain text.
- JWT in **HTTP-only cookies** (with `Authorization: Bearer` fallback for API clients).
- Logged-out tokens are **blacklisted** in MongoDB so they can't be reused.
- Reports are always queried by **owner**, so users can only access their own data.
- Upload size limited to **3 MB**; secrets kept in `.env` (git-ignored).

## 🔮 Future Improvements

- Mock interview mode with voice input and AI feedback
- Shareable report links and PDF export of the full report
- Cloud deployment (Vercel + Render) with environment-based API URLs
- Unit and integration tests

## 👩‍💻 Author

**Simran Maurya**

If you found this project useful, consider giving it a ⭐!
