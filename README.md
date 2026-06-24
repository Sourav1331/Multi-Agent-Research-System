# Multi-Agent Research System

A full-stack AI research application that streams a LangGraph-powered, multi-agent research workflow to a React frontend.

## Architecture

```text
User
  |
  v
React frontend served by Nginx
  |
  |  SSE stream over /api/research/stream
  v
FastAPI Backend
  |
  v
LangGraph State Machine
  |
  +--> Researcher Agent -----> Tavily Web Search
  |
  +--> Summarizer Agent -----> Groq LLaMA 3.1
  |
  +--> Writer Agent ---------> Groq LLaMA 3.1
  |
  +--> Fact Checker Agent ---> Groq LLaMA 3.1
  |
  v
Final Markdown Report
```

## Features

- Real-time streaming progress from backend to frontend using server-sent events.
- Four-agent pipeline: researcher, summarizer, writer, and fact checker.
- LangGraph state machine orchestration with shared workflow state.
- Tavily-powered web research for current information.
- Optional RAG-ready document retrieval using Hugging Face embeddings and persistent ChromaDB.
- Markdown report rendering with copy and download actions.
- Docker Compose setup for backend, Nginx-served frontend, and persistent ChromaDB storage.

## Tech Stack

| Backend | Frontend | AI | DevOps |
| --- | --- | --- | --- |
| FastAPI | React 18 | Groq LLaMA 3.1 8B | Docker |
| LangGraph | Vite | LangChain | Docker Compose |
| Pydantic | Tailwind CSS | Tavily Search | Persistent volumes |
| ChromaDB | React Markdown | Hugging Face embeddings | Environment config |

## Setup

1. Clone the repo:

   ```bash
   git clone https://github.com/Sourav1331/Multi-Agent-Research-System.git
   cd multi-agent-research
   ```


2. Fill in your API keys in `.env`:

   ```env
   GROQ_API_KEY=your_groq_api_key_here
   TAVILY_API_KEY=your_tavily_api_key_here
   FRONTEND_URL=https://multi-agent-research-system-rose.vercel.app
   ```

3. Get API keys from:

   - Groq: https://console.groq.com
   - Tavily: https://tavily.com

4. Start the full stack:

   ```bash
   docker-compose up --build
   ```

5. Open the app:

   ```text
   http://localhost:5173
   ```

The backend API docs are available at:

```text
http://localhost:8000/docs
```

For the deployed app, use these service URLs:

```text
Frontend: https://multi-agent-research-system-rose.vercel.app/
Backend:  https://multi-agent-research-system-qvbr.onrender.com
```

On Vercel, set this frontend environment variable if you want to override the built-in backend URL:

```env
VITE_API_URL=https://multi-agent-research-system-qvbr.onrender.com
```

On Render, set this backend environment variable so FastAPI CORS allows the Vercel app:

```env
FRONTEND_URL=https://multi-agent-research-system-rose.vercel.app
```

For faster deployed summarization, leave Chroma persistence disabled unless you need cross-request vector retrieval:

```env
ENABLE_CHROMA_PERSISTENCE=false
USE_LLM_SUMMARIZER=false
```

The default summarizer now extracts compact source summaries without an extra Groq call, which avoids the deployment hang where the workflow stays on the summarizer step. If you explicitly want LLM-based source summaries, set `USE_LLM_SUMMARIZER=true`; use `SUMMARY_LLM_TIMEOUT_SECONDS=25` to keep it from waiting too long per source.

In Docker, the frontend container serves the built React app on port `5173` and proxies `/api/*` plus `/health` to the backend container.

## Project Structure

```text
multi-agent-research/
├── backend/
│   ├── agents/          # Researcher, summarizer, writer, and fact-checker agents
│   ├── api/             # FastAPI route definitions
│   ├── core/            # LangGraph orchestration, shared state, and tools
│   ├── main.py          # FastAPI application entry point
│   ├── requirements.txt # Python dependencies
│   └── Dockerfile       # Backend container image
├── frontend/
│   ├── src/
│   │   ├── components/  # Query input, progress, badges, and report display
│   │   ├── App.jsx      # Main streaming frontend workflow
│   │   └── index.css    # Tailwind imports and custom markdown styles
│   ├── package.json     # Frontend dependencies and scripts
│   ├── vite.config.js   # Vite dev server and Docker proxy config
│   └── Dockerfile       # Frontend container image
├── docker-compose.yml   # Full-stack container orchestration
├── .env.example         # Safe environment template
└── README.md
```

## API Keys

All three services provide free-tier access suitable for local development.

- Groq API key: create an account at https://console.groq.com, open API Keys, and generate a new key.
- Tavily API key: create an account at https://tavily.com, then copy your API key from the dashboard.


Keep real secrets in `.env` only. The `.env` file is ignored by Git; commit `.env.example` with placeholder values instead.
