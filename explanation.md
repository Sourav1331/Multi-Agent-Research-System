# Multi-Agent Research System - Full Project Explanation

This document explains the complete project in detail: what it does, how the frontend and backend are connected, how each library is used, how uploaded documents work, and what happens internally after a user submits a query.

## 1. Project Overview

The Multi-Agent Research System is a full-stack AI research application.

The user gives a research query such as:

```text
What are the best practices in microservices architecture?
```

The user can also upload documents such as:

```text
.pdf
.txt
.md
.csv
.json
.log
```

The system then:

1. Searches the web for relevant information.
2. Reads uploaded document text.
3. Combines web results and uploaded documents as sources.
4. Summarizes the source material.
5. Writes a markdown report.
6. Fact-checks the generated report.
7. Adds numbered citations and a clean source list.
8. Shows the final report in the frontend.
9. Lets the user copy, export Markdown, or export PDF.
10. Saves completed reports in local browser history.

The goal is to provide a research workflow where the user can inspect both the generated report and the sources behind it.

## 2. Whole Architecture

The project has two main parts:

- Frontend: React + Vite application.
- Backend: FastAPI + LangGraph research API.

The frontend runs at:

```text
http://localhost:5173
```

The backend runs at:

```text
http://localhost:8000
```

In local development, the frontend sends API requests to `/api/...`. Vite proxies those requests to the backend.

```text
User
  |
  | enters query and uploads optional documents
  v
React Frontend
  |
  | POST /api/research/stream
  v
FastAPI Backend
  |
  v
LangGraph Workflow
  |
  +-- Researcher Agent
  |
  +-- Summarizer Agent
  |
  +-- Writer Agent
  |
  +-- Fact Checker Agent
  |
  v
Final Report + Sources + Fact Checks
  |
  v
React Frontend UI
```

## 3. Project Folder Structure

```text
multi-agent-research/
|-- backend/
|   |-- agents/
|   |   |-- researcher.py
|   |   |-- summarizer.py
|   |   |-- writer.py
|   |   `-- fact_checker.py
|   |
|   |-- api/
|   |   `-- routes.py
|   |
|   |-- core/
|   |   |-- orchestrator.py
|   |   |-- state.py
|   |   `-- tools.py
|   |
|   |-- main.py
|   |-- requirements.txt
|   `-- Dockerfile
|
|-- frontend/
|   |-- src/
|   |   |-- components/
|   |   |   |-- AgentProgress.jsx
|   |   |   |-- QueryInput.jsx
|   |   |   |-- ReportDisplay.jsx
|   |   |   `-- StatusBadge.jsx
|   |   |
|   |   |-- App.jsx
|   |   |-- index.css
|   |   `-- main.jsx
|   |
|   |-- index.html
|   |-- package.json
|   |-- package-lock.json
|   |-- vite.config.js
|   |-- tailwind.config.js
|   `-- Dockerfile
|
|-- docker-compose.yml
|-- .env.example
|-- README.md
`-- explanation.md
```

## 4. Backend Architecture

The backend is responsible for:

- Receiving research requests.
- Validating request data.
- Running the multi-agent workflow.
- Calling external tools and models.
- Streaming progress events back to the frontend.
- Returning the final report, metadata, fact-check notes, and sources.

### 4.1 backend/main.py

This is the FastAPI application entry point.

It does the following:

- Loads environment variables from `.env`.
- Creates the FastAPI app.
- Configures CORS so the frontend can call the backend.
- Registers API routes from `api/routes.py`.
- Provides a root endpoint.

CORS is important because the frontend runs on port `5173` and the backend runs on port `8000`. Browsers block cross-origin requests unless the backend explicitly allows them.

### 4.2 backend/api/routes.py

This file defines API routes.

Main route:

```text
POST /api/research/stream
```

This is the route used by the frontend. It receives:

```json
{
  "query": "research question",
  "uploaded_documents": [
    {
      "title": "file.pdf",
      "content": "extracted text"
    }
  ]
}
```

It starts the backend workflow and streams progress events back to the frontend.

Other routes:

```text
POST /api/research
GET /api/health
GET /api/history
```

The streaming route is the most important one for the UI.

### 4.3 backend/core/state.py

This file defines the shared workflow state.

The state is a dictionary-like object passed between all agents.

Important fields:

```text
query
search_results
uploaded_documents
summaries
draft_report
fact_check_notes
final_report
current_agent
error
metadata
```

Each agent reads from this state and writes its own output back into it.

Example:

- Researcher fills `search_results`.
- Summarizer fills `summaries`.
- Writer fills `draft_report`.
- Fact checker fills `fact_check_notes` and `final_report`.

### 4.4 backend/core/orchestrator.py

This file builds and runs the LangGraph workflow.

The graph order is:

```text
researcher -> summarizer -> writer -> fact_checker -> END
```

The orchestrator also streams events back to the frontend.

Example event:

```json
{
  "current_agent": "researcher",
  "status": "completed",
  "data": {
    "sources_found": 5
  }
}
```

Final event:

```json
{
  "current_agent": "complete",
  "status": "complete",
  "data": {
    "final_report": "...",
    "metadata": {},
    "sources": []
  }
}
```

The frontend listens to these events and updates the progress UI in real time.

### 4.5 backend/core/tools.py

This file defines tools that agents can use.

Main tools:

- `web_search_tool`
- `document_retrieval_tool`
- `python_repl_tool`
- `summarize_text_tool`

The most important tool for current research is `web_search_tool`, which uses Tavily to search the web.

The retrieval tool uses ChromaDB and Hugging Face embeddings to retrieve relevant stored document chunks.

## 5. Backend Agents

The backend has four main agents.

### 5.1 Researcher Agent

File:

```text
backend/agents/researcher.py
```

Purpose:

- Search the web.
- Normalize search results.
- Add uploaded documents as sources.
- Assign source IDs.

The Researcher agent calls Tavily search through the web search tool.

A web result becomes:

```json
{
  "id": 1,
  "title": "Article title",
  "url": "https://example.com",
  "content": "Search result snippet",
  "score": 0.9,
  "source_type": "web"
}
```

An uploaded document becomes:

```json
{
  "id": 6,
  "title": "uploaded-file.pdf",
  "url": "",
  "content": "Extracted document text",
  "score": 1,
  "source_type": "document"
}
```

Both web results and uploaded documents are stored in:

```text
state["search_results"]
```

This is important because later agents can treat them as one common source list.

### 5.2 Summarizer Agent

File:

```text
backend/agents/summarizer.py
```

Purpose:

- Read all sources.
- Summarize each source.
- Store summaries in the workflow state.
- Save summary chunks into ChromaDB.

The summarizer uses the language model to extract key factual points from each source.

The output is stored in:

```text
state["summaries"]
```

Why summarization is needed:

Raw search snippets and uploaded documents can be long or noisy. The writer agent needs a cleaner set of key points, so the summarizer prepares that information.

### 5.3 Writer Agent

File:

```text
backend/agents/writer.py
```

Purpose:

- Generate the draft markdown report.
- Use the user query.
- Use summarized source material.
- Use numbered citations.

The writer is instructed to structure the report as:

```text
## Overview
## Key Findings
## Detailed Analysis
## Conclusion
```

It is also instructed not to create fake reference sections. This prevents repeated placeholder references like:

```text
[Insert Source Title]
```

The writer should cite sources like:

```text
Microservices should be independently deployable [1].
```

The draft report is stored in:

```text
state["draft_report"]
```

### 5.4 Fact Checker Agent

File:

```text
backend/agents/fact_checker.py
```

Purpose:

- Review the draft report.
- Identify key claims.
- Check whether claims are supported by the source summaries.
- Produce fact-check notes.
- Remove or revise unsupported claims.
- Append clean numbered sources.

Fact-check notes look like:

```json
{
  "claim": "The claim text",
  "verified": true,
  "confidence": 0.85,
  "source": "Source title or URL"
}
```

The final report is stored in:

```text
state["final_report"]
```

## 6. Frontend Architecture

The frontend is responsible for:

- Showing the UI.
- Accepting the query.
- Reading uploaded files.
- Extracting text from PDFs.
- Sending the request to the backend.
- Reading streamed progress.
- Displaying agent progress.
- Displaying the final report.
- Showing source viewer and fact-check results.
- Saving local report history.
- Handling theme switching.
- Exporting Markdown and PDF.

### 6.1 frontend/src/App.jsx

This is the main frontend component.

It manages:

- current query
- loading state
- active agent
- agent status map
- final report
- fact-check notes
- source list
- local history
- dark/light theme

It sends the request:

```javascript
fetch(`${API_BASE_URL}/api/research/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: nextQuery,
    uploaded_documents: uploadedDocuments,
  }),
})
```

It then reads the response stream using:

```javascript
response.body.getReader()
```

Each streamed event updates the UI.

### 6.2 QueryInput.jsx

This component handles:

- query textbox
- example query buttons
- file upload
- PDF extraction
- document removal
- submit button

PDF extraction is done in the browser using `pdfjs-dist`.

For PDF:

1. Read file as `ArrayBuffer`.
2. Load it with pdf.js.
3. Loop through each page.
4. Extract text content.
5. Join page text.
6. Send extracted text to backend.

For text files:

```javascript
file.text()
```

is used directly.

### 6.3 AgentProgress.jsx

This component shows:

- workflow progress percentage
- Researcher status
- Summarizer status
- Writer status
- Fact Checker status

It uses progress events streamed by the backend.

### 6.4 ReportDisplay.jsx

This component shows:

- final markdown report
- source viewer
- fact-check notes
- copy button
- markdown download button
- PDF export button

The report is rendered with `ReactMarkdown`.

The Source Viewer shows:

- source ID
- source type
- title
- source snippet
- external link for web sources

### 6.5 StatusBadge.jsx

This component renders small status badges like:

- waiting
- running
- done
- failed

## 7. What Happens After The Query Is Given

This is the complete query flow in simple terms.

### Step 1: User Submits Query

The user enters a question and clicks Research.

The frontend collects:

- query text
- uploaded document text

### Step 2: Frontend Sends Request

The frontend sends:

```text
POST /api/research/stream
```

with query and uploaded documents.

### Step 3: Backend Validates Request

FastAPI and Pydantic validate:

- query exists
- query length is valid
- uploaded documents are in list format

### Step 4: Backend Creates Initial State

The backend creates:

```python
state = initial_state(query)
```

Then it adds uploaded documents:

```python
state["uploaded_documents"] = cleaned_documents
```

### Step 5: Researcher Runs

The Researcher:

- searches web using Tavily
- receives web results
- converts them into normalized sources
- adds uploaded documents as extra sources
- assigns source IDs

Then backend streams:

```json
{
  "current_agent": "researcher",
  "status": "completed"
}
```

### Step 6: Summarizer Runs

The Summarizer:

- reads sources
- summarizes each source
- stores summaries
- saves summary chunks to ChromaDB

Then backend streams:

```json
{
  "current_agent": "summarizer",
  "status": "completed"
}
```

### Step 7: Writer Runs

The Writer:

- reads query
- reads source summaries
- reads numbered source catalog
- writes markdown report
- includes numbered citations

Then backend streams:

```json
{
  "current_agent": "writer",
  "status": "completed"
}
```

### Step 8: Fact Checker Runs

The Fact Checker:

- reads draft report
- checks claims
- verifies support from sources
- revises unsupported claims
- appends final source list

Then backend streams:

```json
{
  "current_agent": "fact_checker",
  "status": "completed"
}
```

### Step 9: Backend Sends Final Event

The final event contains:

- final report
- metadata
- sources

Example:

```json
{
  "current_agent": "complete",
  "status": "complete",
  "data": {
    "final_report": "## Overview...",
    "metadata": {
      "total_sources": 6,
      "processing_time": 45.2,
      "timestamp": "2026-06-21 10:00 UTC"
    },
    "sources": []
  }
}
```

### Step 10: Frontend Displays Output

The frontend:

- marks all agents completed
- renders final report
- shows source viewer
- shows fact-check table
- saves the report in local history

## 8. How Streaming Works

The backend does not wait until the full workflow is finished before sending anything.

Instead, it streams progress after each agent completes.

The frontend reads the stream chunk by chunk.

This makes the app feel responsive because the user can see:

- Researcher completed
- Summarizer running
- Writer completed
- Fact Checker running

without waiting silently.

## 9. Uploaded Document Flow

Uploaded documents are handled in the frontend first.

### PDF Upload Flow

```text
PDF file
  |
  v
pdfjs-dist extracts text
  |
  v
Frontend creates uploaded document object
  |
  v
Backend receives extracted text
  |
  v
Researcher adds it as source_type=document
```

### Text Upload Flow

```text
Text-like file
  |
  v
Browser reads file.text()
  |
  v
Frontend creates uploaded document object
  |
  v
Backend receives text
```

The backend does not permanently store uploaded files. It only receives extracted text for the current research request.

## 10. How Sources Work

All sources are normalized into the same format.

Web source:

```json
{
  "id": 1,
  "title": "Web article title",
  "url": "https://example.com",
  "content": "Snippet",
  "score": 0.9,
  "source_type": "web"
}
```

Uploaded document:

```json
{
  "id": 2,
  "title": "uploaded-file.pdf",
  "url": "",
  "content": "Extracted text",
  "score": 1,
  "source_type": "document"
}
```

The writer can cite these as:

```text
[1]
[2]
[3]
```

The final report includes:

```markdown
## Sources

1. [Web article title](https://example.com)
2. uploaded-file.pdf (uploaded document)
```

## 11. Local History

The frontend saves completed reports in browser `localStorage`.

Saved fields:

- query
- final report
- fact-check notes
- metadata
- sources
- creation time

This means history is:

- local to the browser
- not stored in the backend
- not shared across devices

## 12. Export System

### Copy

Copies the raw markdown report to clipboard.

### Markdown

Downloads:

```text
research-report.md
```

### PDF

Opens the browser print dialog with a styled report layout.

The user can choose:

```text
Save as PDF
```

This preserves:

- headings
- colors
- font sizes
- source viewer
- fact-check results

## 13. Libraries And What They Do

### Backend Libraries

#### fastapi

Creates the backend API.

#### uvicorn

Runs the FastAPI server locally.

#### pydantic

Validates request data.

#### python-dotenv

Loads `.env` environment variables.

#### langgraph

Creates the multi-step agent workflow.

#### langchain

Provides abstractions for model calls and tools.

#### langchain-groq

Connects LangChain to Groq chat models.

#### langchain-community

Provides community integrations, including Tavily search tools and Chroma vector store integration.

#### langchain-huggingface

Provides Hugging Face embedding support.

#### chromadb

Stores vector embeddings and summary chunks.

#### tavily-python

Allows web search through Tavily.

#### sentence-transformers

Used by Hugging Face embeddings to generate vector representations of text.

#### httpx

HTTP client library used by parts of the backend dependency stack.

### Frontend Libraries

#### react

Builds the user interface.

#### react-dom

Renders React into the browser DOM.

#### vite

Runs the frontend dev server and builds production assets.

#### tailwindcss

Provides utility-first styling.

#### lucide-react

Provides icons.

#### react-markdown

Renders markdown reports as HTML.

#### pdfjs-dist

Extracts text from uploaded PDF files.

#### axios

Installed HTTP client. The current streaming flow uses `fetch`, but Axios remains available for normal API calls.

## 14. Environment Variables

The backend expects:

```env
GROQ_API_KEY=your_groq_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
HF_TOKEN=your_huggingface_token_here
FRONTEND_URL=http://localhost:5173
```

### GROQ_API_KEY

Used for model calls.

### TAVILY_API_KEY

Used for web search.

### HF_TOKEN

Used for Hugging Face embedding model access.

### FRONTEND_URL

Used for CORS.

## 15. Running The Project Locally

### Backend

From project root:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Start backend:

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Backend:

```text
http://localhost:8000
```

Docs:

```text
http://localhost:8000/docs
```

### Frontend

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Frontend:

```text
http://localhost:5173
```

## 16. Common Problems

### Port 5173 already in use

Find process:

```powershell
netstat -ano | Select-String ':5173'
```

Stop it:

```powershell
Stop-Process -Id <PID> -Force
```

### Unable to fetch

Check backend is running:

```text
http://localhost:8000/docs
```

Check frontend is running:

```text
http://localhost:5173
```

### CORS error

Check `.env`:

```env
FRONTEND_URL=http://localhost:5173
```

Restart backend.

### PDF upload gives empty text

The PDF may be scanned or image-only. This project does not currently perform OCR.

### Backend dependency missing

Install requirements:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

## 17. Current Limitations

- No user accounts.
- Report history is local only.
- No backend database for reports.
- No OCR for scanned PDFs.
- Uploaded documents are trimmed.
- External API keys are required.
- Fact-checking depends on source quality and model behavior.

## 18. Possible Future Improvements

- OCR support for scanned PDFs.
- DOCX upload support.
- Backend database for report history.
- User authentication.
- Claim-to-source highlighting.
- Cost tracking.
- More export templates.
- Admin dashboard.
- Better source quality scoring.
- Research depth controls.

## 19. Summary

This project is a complete local AI research workflow. The frontend handles user interaction, uploads, theming, history, and export. The backend handles search, summarization, report writing, fact checking, and streaming progress.

The most important idea is the shared workflow state:

```text
query -> sources -> summaries -> draft report -> verified final report
```

Every agent adds one layer of value, and the frontend streams those steps so the user can see the research process happen in real time.
