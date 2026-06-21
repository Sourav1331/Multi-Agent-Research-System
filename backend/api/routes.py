from fastapi import APIRouter
from pydantic import BaseModel

from core.orchestrator import run_research

router = APIRouter(prefix="/api")


class ResearchRequest(BaseModel):
    query: str


@router.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}


@router.post("/research")
async def research_endpoint(payload: ResearchRequest) -> dict:
    return await run_research(payload.query)
