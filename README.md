# ADAPTS - Adaptive Learning Assessment Platform

ADAPTS is a full-stack web application designed to help users assess their understanding of various topics. Users select a field of study, select a subject, and describe what they learned today. The platform uses Gemini AI (via the Gemini API) to generate 5 tailored, pedagogical questions testing both conceptual and practical understanding.

---

## 🌟 Features

- **Home Page**: Premium landing interface highlighting core engine elements.
- **Assessment Form**: Clean, glassmorphic layout featuring dynamic subject selections based on the field of study, input validation, and real-time character counters.
- **AI Assessment Generator**: Real-time generation of 5 conceptual and practical questions using the Gemini API.
- **Loading State**: An interactive loader displaying rotating pedagogical tips and a smooth spinning visual.
- **Results View**: A layout displaying generated questions in card forms, with action utilities to copy a single question, copy the entire assessment, print the page, or export the questions as a Markdown file.
- **Database Integration**: Automatically persists all generated questions and topics. Defaults to an in-memory H2 database for out-of-the-box operation and supports PostgreSQL.

---

## 🏗️ Folder Structure

```
ADAPTS/
├── backend/
│   ├── pom.xml
│   └── src/
│       └── main/
│           ├── java/com/adapts/
│           │   ├── client/
│           │   │   └── GeminiClient.java          # Connector to Gemini API
│           │   ├── controller/
│           │   │   └── AssessmentController.java  # REST API Controller
│           │   ├── dto/
│           │   │   ├── AssessmentRequest.java     # Request Data Record
│           │   │   └── AssessmentResponse.java    # Response Data Record
│           │   ├── exception/
│           │   │   └── GlobalExceptionHandler.java# JSON REST Error formatter
│           │   ├── model/
│           │   │   └── Assessment.java            # JPA entity mapping
│           │   ├── repository/
│           │   │   └── AssessmentRepository.java  # JPA Repository
│           │   └── AdaptsApplication.java         # Spring Boot Entry Point
│           └── resources/
│               ├── application.properties         # App config (Ports, CORS, DB)
│               └── schema.sql                     # PostgreSQL setup DDL script
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js                         # Tailwind UI styles & keyframes
│   ├── postcss.config.js
│   ├── index.html                                 # SEO & Font imports
│   └── src/
│       ├── main.jsx                               # React entry
│       ├── index.css                              # Tailwind base & glassmorphism components
│       ├── App.jsx                                # Main views coordinator
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── Footer.jsx
│       │   ├── Loader.jsx                         # Rotating-quote loader
│       │   └── QuestionCard.jsx                   # Flashcard layout & copy utilities
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── AssessmentForm.jsx
│       │   └── Results.jsx
│       └── services/
│           └── api.js                             # API caller client
└── README.md
```

---

## 🛠️ Prerequisites

Make sure you have the following installed on your machine:
- **Java Development Kit (JDK)**: Version 17 or higher
- **Node.js**: Version 18.0.0 or higher (includes `npm`)
- **Apache Maven**: Version 3.8.0 or higher

---

## 🚀 Setup Instructions

### 1. Gemini API Key Setup

You need a Gemini API Key to run this application. Obtain one from the [Google AI Studio](https://aistudio.google.com/).

Set the key as an environment variable:

**On Windows (Command Prompt):**
```cmd
set GEMINI_API_KEY=your_gemini_api_key_here
```

**On Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="your_gemini_api_key_here"
```

**On macOS / Linux:**
```bash
export GEMINI_API_KEY="your_gemini_api_key_here"
```

---

### 2. Run the Backend (Spring Boot)

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Run compilation and start the server:
   ```bash
   mvn spring-boot:run
   ```
   The backend server will start on port `8080`.
   - Swagger / H2 Console: `http://localhost:8080/h2-console`
     - JDBC URL: `jdbc:h2:mem:adaptsdb`
     - Username: `sa`
     - Password: *(Leave blank)*

---

### 3. Run the Frontend (React + Vite)

1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch the development server:
   ```bash
   npm run dev
   ```
   The frontend will boot up on `http://localhost:5173`. Open this URL in your web browser.

---

## 🗄️ Database Integration

### Out-of-the-Box Mode (H2)
By default, the backend uses an **in-memory H2 database** to run instantly without requiring a local database server installation. All generated assessments are persisted to H2 in-memory history.

### PostgreSQL Mode
To switch the platform to PostgreSQL for production use:
1. Ensure a PostgreSQL instance is running and create a database named `adapts`.
2. Open `backend/src/main/resources/application.properties` and:
   - Comment out the H2 Database settings block.
   - Uncomment the PostgreSQL Database settings block.
   - Update `spring.datasource.username` and `spring.datasource.password` to match your Postgres server credentials.
3. The schema is automatically created by Hibernate (`ddl-auto=update`). If you want to configure schemas manually, use the DDL queries provided in [schema.sql](file:///c:/projects/ADAPTS/backend/src/main/resources/schema.sql).

---

## 📡 Backend API Contract

### Generate Assessment Questions
Generate a list of 5 questions based on a field, subject, and topic description.

- **URL**: `/api/generate-questions`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "field": "Engineering",
    "subject": "Java",
    "topic": "I learned variables, data types, loops and methods today."
  }
  ```
- **Response Format (200 OK)**:
  ```json
  {
    "questions": [
      "Explain the key differences between primitive types like int and non-primitive types like Integer in Java.",
      "Write a short method in Java that takes a variable and outputs a different message depending on a loop count.",
      "Why are variables declared final in Java, and when should you use them?",
      "Under what scenario would you choose a while loop instead of a standard for loop?",
      "Provide an example of passing parameters into a method by reference vs value in Java."
    ]
  }
  ```
- **Error Format (400/500)**:
  ```json
  {
    "error": "Bad Request - Validation Failed",
    "message": "Describe what you learned today in at least 10 characters",
    "status": 400,
    "timestamp": "2026-07-17T11:12:00.3254"
  }
  ```
