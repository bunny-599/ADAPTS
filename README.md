# ADAPTS (Adaptive Assessment Platform)

> **"Don't just ask me what I know. Put me in a situation where I have to prove I know it."**  
> *Learn it. Test it. Prove it.*

ADAPTS is a production-grade, AI-powered adaptive assessment platform designed specifically for **Computer Science**. The learner inputs what they studied; ADAPTS decomposes the topic, conducts web-grounded research, prompts for clarification if the input is ambiguous, provides a concise revision refresher, generates grounded candidate questions, verifies question-answer semantic correctness through deterministic and LLM validation, optimizes the assessment using a Genetic Algorithm, and provides a server-timed, autosaved assessment taking experience. Evaluated performance updates a verifiable skill profile and directly drives future adaptive assessments.

---

## 1. Product & Architecture Overview

### Central Product Loop
```
LOGIN (Clerk Authentication)
  ↓
DASHBOARD (Personalized, Zero Fake Data)
  ↓
START NEW ASSESSMENT ("What did you learn?" → Analyze Topic)
  ↓
TOPIC ANALYSIS (/api/topics/analyze)
  ↓
CLARIFICATION (If Ambiguous → Radio Selection)
  ↓
WEB RESEARCH (/api/research with Source Credibility)
  ↓
QUICK REVISION ("Your Topic at a Glance" Refresher)
  ↓
ASSESSMENT PREPARATION (Automated: Candidate Gen → Semantic Validation → GA Optimization)
  ↓
ASSESSMENT TAKING (3-Column Layout: Navigator, Question/Answer Area, Server-Synced Timer & Controls)
  ↓
SUBMISSION (Transactional Confirmation Modal & Duplicate Prevention)
  ↓
REAL EVALUATION (Deterministic MCQ + LLM Rubric + Docker C++ Sandbox)
  ↓
PERFORMANCE RESULTS & SKILL PROFILING (Empirical Confidence & Trend Detection)
  ↓
ADAPTIVE NEXT ASSESSMENT (Dynamic Difficulty Adjustment: 0.20–0.85, Clamped Step ≤ 0.08)
```

---

## 2. Key Engineering Capabilities

1. **Real Clerk Authentication & User Isolation:**
   - Real Clerk session identity in navbar and sidebar (`displayName`, `avatarUrl`, email, and Clerk account profile management).
   - Strict database tenant isolation: queries are scoped to verified authenticated user contexts. User A cannot view User B's attempts, responses, skills, or notifications.

2. **Automated Pipeline (No User-Facing "Generate Questions"):**
   - Candidate generation, multi-stage semantic validation, and Genetic Algorithm selection run autonomously behind the scenes after research and revision.

3. **Semantic Question-Answer Validation & Correctness:**
   - Dedicated `questionAnswerConsistency` validator enforces algorithm mechanisms and complexity constraints.
   - **Critical Regression Tests Enforced:**
     - Linear search primary mechanism: Sequential scanning (**PASS**); divide-and-conquer (**FAIL**).
     - Linear search best-case time complexity: $O(1)$ (**PASS**); $O(N)$ (**FAIL**).
     - Linear search worst-case time complexity: $O(N)$ (**PASS**); $O(1)$ (**FAIL**).
     - Linear search average-case time complexity: $O(N)$ (**PASS**).
     - Binary search primary mechanism: Repeatedly divide sorted search interval (**PASS**); sequential scan (**FAIL**).
     - Data structure operational disciplines: Stack (LIFO), Queue (FIFO), BFS (Queue), DFS (Stack/recursion).

4. **Genetic Algorithm Optimizer:**
   - Multi-objective fitness function optimizing:
     - Topic & subtopic coverage
     - Skill alignment & priority weights
     - Difficulty target alignment ($0.0 \le D \le 1.0$)
     - Question type diversity (MCQ, Conceptual, Debugging, Scenario, Coding)
     - Cognitive diversity (Bloom's Taxonomy: remember, understand, apply, analyze, evaluate)
     - Redundancy penalty & estimated duration fit

5. **Server-Authoritative Timer & Autosave:**
   - Server computes remaining duration based on `started_at` and `duration_seconds`.
   - Browser refresh or opening multiple tabs retains exact server countdown.
   - Autosaves every answer selection/input progressively to database (`POST /api/attempts/:attemptId/responses`).

6. **Real-Time Notifications & History:**
   - Unread badge counter, notification dropdown panel with mark-as-read and mark-all-read operations.
   - Chronological attempt history with accuracy metrics, completion rates, and adaptive skill trends.

7. **Zero Fake Data:**
   - Clean, elegant empty states for users with 0 assessments. No mock cards, fake analytics, or decorative gamification XP.

---

## 3. Technology Stack

- **Frontend:** React 18, TypeScript, Vite, `@clerk/react`, Vanilla CSS Design Tokens (Dark Theme: Deep Charcoal `#070a12`, Cyan/Electric Blue accents `#0284c7`/`#38bdf8`)
- **Backend:** Node.js, Express.js, TypeScript, PostgreSQL (`pg`), `@google/genai` (Gemini SDK), Tavily Search API
- **Evaluation:** Deterministic MCQ comparator, LLM Free-Text Rubric Evaluator, Docker C++ Sandbox (`--network none`, memory/CPU/PID limits)
- **Database:** PostgreSQL (`topics`, `research_sessions`, `research_sources`, `candidate_questions`, `assessments`, `assessment_attempts`, `assessment_responses`, `answer_evaluations`, `performance_analyses`, `skill_profiles`, `notifications`, `users`)

---

## 4. Environment Variables

Create `.env` in the root directory (and `backend/.env`, `frontend/.env.local`):

### Backend (`backend/.env`)
```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/adaptive_assessment
GEMINI_API_KEY=your_gemini_api_key_here
SEARCH_PROVIDER_KEY=your_tavily_or_search_api_key
JWT_SECRET=your_jwt_signing_secret_min_32_chars
CLERK_SECRET_KEY=your_clerk_backend_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

### Frontend (`frontend/.env.local`)
```env
VITE_API_URL=http://localhost:5000
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

---

## 5. Local Setup & Execution

### 1. Install Dependencies
```bash
# In backend
cd backend
npm install

# In frontend
cd ../frontend
npm install
```

### 2. Database Migration
Ensure PostgreSQL is running, then run schema initialization:
```bash
psql -U postgres -d adaptive_assessment -f database/schema.sql
```

### 3. Run Backend Test Suite
```bash
cd backend
npm run test
```
All 12 test suites (Topic Analysis, Research, Question Generation, Question Validation, Genetic Optimization, Assessment Taking, Performance Analysis, Adaptive Next Assessment, Learner Progress, Answer Evaluation, Sandbox Execution, and Production Hardening) will execute.

### 4. Build Applications
```bash
# Build backend
cd backend
npm run build

# Build frontend
cd ../frontend
npm run build
```

### 5. Start Development Servers
```bash
# Terminal 1: Backend API
cd backend
npm run dev

# Terminal 2: Frontend Client
cd frontend
npm run dev
```

---

## 6. API Reference (Core Endpoints)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/topics/analyze` | Decompose topic input or return clarification requirements |
| `POST` | `/api/topics` | Persist structured topic metadata |
| `GET` | `/api/topics/:topicId` | Fetch topic by ID |
| `POST` | `/api/research` | Search web and extract verified research knowledge |
| `POST` | `/api/research/revision` | Generate concise Quick Revision bullet points |
| `POST` | `/api/questions/generate` | (Internal) Generate grounded candidate question pool |
| `POST` | `/api/questions/validate` | (Internal) Validate structure, sources, and semantic consistency |
| `POST` | `/api/assessments/optimize` | (Internal) Run Genetic Algorithm assessment selection |
| `GET` | `/api/assessments/:assessmentId` | Fetch public assessment questions (zero answer key leakage) |
| `POST` | `/api/assessments/:assessmentId/start`| Initialize assessment attempt with authoritative timer |
| `GET` | `/api/attempts/:attemptId` | Retrieve attempt state, saved responses, and remaining time |
| `POST` | `/api/attempts/:attemptId/responses` | Autosave individual student response |
| `POST` | `/api/attempts/:attemptId/submit` | Lock attempt and record final submission transaction |
| `POST` | `/api/attempts/:attemptId/evaluate` | Run deterministic and LLM answer evaluation |
| `POST` | `/api/attempts/:attemptId/analyze` | Compute performance breakdown and skill evidence updates |
| `POST` | `/api/assessments/adaptive` | Synthesize skill profile into next adaptive assessment |
| `GET` | `/api/performance` | Retrieve user-scoped historical performance metrics |
| `GET` | `/api/skills` | Retrieve user-scoped verified skill profiler data |
| `GET` | `/api/notifications` | Fetch user notifications and unread badge count |
| `PATCH`| `/api/notifications/:id/read` | Mark single notification as read |
| `POST` | `/api/notifications/read-all` | Mark all notifications as read |
| `GET` | `/api/me` | Fetch authenticated user identity context |

---

## 7. Roadmap & Scope Constraints
- **Current Version:** Exclusively supports **Computer Science**.
- **Future Expansions:** Additional domains (Electronics, Medicine, Finance) and multi-language sandbox runtimes (Python, Java, Rust).
