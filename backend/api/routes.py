"""API routes for the multi-agent research workflow."""

import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.orchestrator import run_research, run_research_stream

router = APIRouter(prefix="/api", tags=["research"])

research_history: list[str] = []


class ResearchRequest(BaseModel):
    query: str = Field(..., min_length=10, max_length=500)


def _clean_query(query: str) -> str:
    cleaned = query.strip()
    if not cleaned:
        raise HTTPException(status_code=422, detail="Query cannot be empty")
    return cleaned


@router.post("/research/stream")
async def research_stream_endpoint(payload: ResearchRequest) -> StreamingResponse:
    query = _clean_query(payload.query)
    research_history.append(query)
    del research_history[:-10]

    async def event_stream():
        async for chunk in run_research_stream(query):
            yield f"data: {chunk.strip()}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/research")
async def research_endpoint(payload: ResearchRequest) -> dict:
    query = _clean_query(payload.query)

    try:
        result = await asyncio.wait_for(run_research(query), timeout=120)
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Research request timed out") from exc

    return {
        "final_report": result.get("final_report", ""),
        "fact_check_notes": result.get("fact_check_notes", []),
        "metadata": result.get("metadata", {}),
        "sources_count": len(result.get("search_results", [])),
    }


@router.get("/health")
async def health_check() -> dict:
    return {
        "status": "ok",
        "agents": ["researcher", "summarizer", "writer", "fact_checker"],
    }


@router.get("/history")
async def history_endpoint() -> dict:
    return {"queries": research_history[-10:]}
