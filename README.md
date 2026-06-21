# Multi-Agent Research System

A full-stack AI research application that streams a LangGraph-powered, multi-agent research workflow to a React frontend.

## Architecture

```text
User
  |
  v
React + Vite Frontend
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
  +--> Summarizer Agent -----> Groq LLaMA 3.1 + ChromaDB
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
- RAG-ready document retrieval using Hugging Face embeddings and persistent ChromaDB.
- Markdown report rendering with copy and download actions.
- Docker Compose setup for backend, frontend, and persistent ChromaDB storage.

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
   git clone <your-repo-url>
   cd multi-agent-research
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in your API keys in `.env`:

   ```env
   GROQ_API_KEY=your_groq_api_key_here
   TAVILY_API_KEY=your_tavily_api_key_here
   HF_TOKEN=your_huggingface_token_here
   FRONTEND_URL=http://localhost:5173
   ```

4. Get API keys from:

   - Groq: https://console.groq.com
   - Tavily: https://tavily.com
   - Hugging Face: https://huggingface.co

5. Start the full stack:

   ```bash
   docker-compose up --build
   ```

6. Open the app:

   ```text
   http://localhost:5173
   ```

The backend API docs are available at:

```text
http://localhost:8000/docs
```

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
- Hugging Face token: create an account at https://huggingface.co, go to Settings, then Access Tokens, and create a token.

Keep real secrets in `.env` only. The `.env` file is ignored by Git; commit `.env.example` with placeholder values instead.
