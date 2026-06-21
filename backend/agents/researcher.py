"""Researcher agent for collecting web sources."""

import logging
import os
import time

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from core.state import ResearchState
from core.tools import web_search_tool

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a research specialist. Your job is to search the web thoroughly for "
    "information about the given query. Always use the web_search tool. "
    "Search for at least 2 different angles of the topic. "
    "Return only factual information with sources."
)


def _invoke_with_retry(llm, messages):
    for attempt in range(3):
        try:
            return llm.invoke(messages)
        except Exception as exc:
            if "429" in str(exc) and attempt < 2:
                time.sleep(2**attempt)
            else:
                raise


def researcher_agent(state: ResearchState) -> ResearchState:
    """Search the web for the user's query and store raw source results."""
    try:
        query = state["query"]
        state["current_agent"] = "researcher"
        state.setdefault("metadata", {})
        state["metadata"]["search_query_used"] = query
        logger.info("Researcher agent started for query: %s", query)

        llm = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.1,
            groq_api_key=os.getenv("GROQ_API_KEY"),
        )
        _invoke_with_retry(
            llm.bind_tools([web_search_tool]),
            [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=query),
            ],
        )

        raw_results = web_search_tool.invoke({"query": query})
        if isinstance(raw_results, str):
            state["error"] = raw_results
            logger.error("Researcher tool failed: %s", raw_results)
            return state

        search_results = [
            {
                "id": index,
                "title": result.get("title", ""),
                "url": result.get("url", ""),
                "content": result.get("content", ""),
                "score": result.get("score", 0),
                "source_type": "web",
            }
            for index, result in enumerate(raw_results, start=1)
        ]

        for document in state.get("uploaded_documents", []):
            content = str(document.get("content", "")).strip()
            title = str(document.get("title", "Uploaded document")).strip() or "Uploaded document"
            if not content:
                continue

            search_results.append(
                {
                    "id": len(search_results) + 1,
                    "title": title,
                    "url": "",
                    "content": content[:6000],
                    "score": 1,
                    "source_type": "document",
                }
            )

        state["search_results"] = search_results
        state["metadata"]["total_sources"] = len(search_results)
        state["metadata"]["uploaded_documents"] = len(state.get("uploaded_documents", []))
        logger.info("Researcher agent collected %s sources", len(search_results))
        return state
    except Exception as exc:
        state["error"] = f"Researcher agent error: {exc}"
        logger.exception("Researcher agent failed")
        return state


async def research(query: str) -> dict:
    """Compatibility wrapper for the initial scaffold orchestrator."""
    state: ResearchState = {
        "query": query,
        "search_results": [],
        "summaries": [],
        "draft_report": "",
        "fact_check_notes": [],
        "final_report": "",
        "current_agent": "researcher",
        "error": None,
        "metadata": {},
    }
    updated_state = researcher_agent(state)
    return {
        "agent": "researcher",
        "query": query,
        "findings": updated_state.get("search_results", []),
    }
