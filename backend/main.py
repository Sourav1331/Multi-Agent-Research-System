import logging
import os

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

load_dotenv()

app = FastAPI(title="Multi-Agent Research API", version="1.0.0")

frontend_origins = {
    "https://multi-agent-research-system-rose.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}

if frontend_url := os.getenv("FRONTEND_URL"):
    frontend_origins.add(frontend_url.rstrip("/"))

if frontend_urls := os.getenv("FRONTEND_URLS"):
    frontend_origins.update(
        frontend_url.strip().rstrip("/")
        for frontend_url in frontend_urls.split(",")
        if frontend_url.strip()
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(frontend_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root() -> dict:
    return {"message": "Multi-Agent Research System API", "docs": "/docs"}


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "agents": ["researcher", "summarizer", "writer", "fact_checker"]}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
