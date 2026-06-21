"""LangGraph orchestration pipeline for the research workflow."""

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

from langgraph.graph import END, StateGraph

from agents.fact_checker import fact_checker_agent
from agents.researcher import researcher_agent
from agents.summarizer import summarizer_agent
from agents.writer import writer_agent
from core.state import ResearchState, initial_state

logger = logging.getLogger(__name__)


def route_after_researcher(state: ResearchState) -> str:
    """Stop early if research failed; otherwise continue to summarization."""
    if state.get("error") is not None:
        logger.error("Research workflow stopped after researcher: %s", state["error"])
        return END
    return "summarizer"


graph = StateGraph(ResearchState)
graph.add_node("researcher", researcher_agent)
graph.add_node("summarizer", summarizer_agent)
graph.add_node("writer", writer_agent)
graph.add_node("fact_checker", fact_checker_agent)

graph.set_entry_point("researcher")
graph.add_conditional_edges("researcher", route_after_researcher)
graph.add_edge("summarizer", "writer")
graph.add_edge("writer", "fact_checker")
graph.add_edge("fact_checker", END)

app = graph.compile()


def extract_agent_output(node_name: str, state: ResearchState) -> dict:
    """Return the compact payload the frontend needs for a completed node."""
    if node_name == "researcher":
        return {"sources_found": len(state.get("search_results", []))}
    if node_name == "summarizer":
        return {"summaries_count": len(state.get("summaries", []))}
    if node_name == "writer":
        return {"draft_length": len(state.get("draft_report", ""))}
    if node_name == "fact_checker":
        return {"fact_check_notes": state.get("fact_check_notes", [])}
    return {}


def _clean_uploaded_documents(uploaded_documents: list[dict] | None) -> list[dict]:
    cleaned: list[dict] = []
    for document in uploaded_documents or []:
        title = str(document.get("title", "Uploaded document")).strip() or "Uploaded document"
        content = str(document.get("content", "")).strip()
        if content:
            cleaned.append({"title": title[:160], "content": content[:12000]})
    return cleaned[:5]


async def run_research_stream(query: str, uploaded_documents: list[dict] | None = None) -> AsyncGenerator[str, None]:
    """
    Yield JSON state updates after each LangGraph node completes.

    Intended for FastAPI StreamingResponse or SSE-style progress updates.
    """
    started_at = time.perf_counter()
    state = initial_state(query)
    state["uploaded_documents"] = _clean_uploaded_documents(uploaded_documents)
    latest_state = state

    try:
        async for event in app.astream(state):
            await asyncio.sleep(0)
            if not event:
                continue

            node_name = list(event.keys())[0]
            node_state = event[node_name]
            latest_state = node_state
            yield json.dumps(
                {
                    "current_agent": node_name,
                    "status": "completed",
                    "data": extract_agent_output(node_name, node_state),
                }
            ) + "\n"

            if node_state.get("error"):
                yield json.dumps(
                    {
                        "current_agent": node_name,
                        "status": "error",
                        "data": {"error": node_state["error"]},
                    }
                ) + "\n"
                return

        yield json.dumps(
            {
                "current_agent": "complete",
                "status": "complete",
                "data": {
                    "final_report": latest_state.get("final_report", ""),
                    "metadata": {
                        **latest_state.get("metadata", {}),
                        "processing_time": round(time.perf_counter() - started_at, 1),
                        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                    },
                    "sources": latest_state.get("search_results", []),
                },
            }
        ) + "\n"
    except Exception as exc:
        logger.exception("Research stream failed")
        yield json.dumps(
            {
                "current_agent": "error",
                "status": "error",
                "data": {"error": f"Research stream error: {exc}"},
            }
        ) + "\n"


async def run_research(query: str, uploaded_documents: list[dict] | None = None) -> ResearchState:
    """Run the full research workflow and return the final state."""
    state = initial_state(query)
    state["uploaded_documents"] = _clean_uploaded_documents(uploaded_documents)

    try:
        result = await app.ainvoke(state)
        return result
    except Exception as exc:
        logger.exception("Research workflow failed")
        state["error"] = f"Research workflow error: {exc}"
        return state
