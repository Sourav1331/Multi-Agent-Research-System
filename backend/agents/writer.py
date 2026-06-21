"""Writer agent for producing the draft research report."""

import logging
import os
import time

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from core.state import ResearchState

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are an expert research writer. Write clear, structured, professional reports. "
    "Use markdown formatting. Always cite sources by mentioning the source title. "
    "Be thorough but concise. Never hallucinate - only use the provided information. "
    "Do not create a References or Sources section; the application adds verified sources separately."
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


def writer_agent(state: ResearchState) -> ResearchState:
    """Write a structured markdown draft report from source summaries."""
    try:
        state["current_agent"] = "writer"
        query = state["query"]
        summaries = state.get("summaries", [])
        search_results = state.get("search_results", [])
        logger.info("Writer agent started with %s summaries", len(summaries))

        if not summaries:
            state["error"] = "No summaries to write report"
            logger.warning("Writer agent stopped: no summaries")
            return state

        llm = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.4,
            groq_api_key=os.getenv("GROQ_API_KEY"),
        )
        source_catalog = "\n".join(
            f"- {result.get('title', 'Untitled source')}: {result.get('url', '')}"
            for result in search_results
        )
        human_prompt = (
            f"Write a comprehensive research report on: {query}\n\n"
            "Available source catalog:\n"
            f"{source_catalog}\n\n"
            "Based on these key findings:\n"
            f"{chr(10).join(summaries)}\n\n"
            "Structure the report with these sections:\n"
            "## Overview\n"
            "## Key Findings\n"
            "## Detailed Analysis\n"
            "## Conclusion\n\n"
            "Use markdown formatting. Mention source titles where relevant. "
            "Do not write placeholder text such as [Insert Source Title]. "
            "Do not add a References or Sources section."
        )

        response = _invoke_with_retry(
            llm,
            [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=human_prompt),
            ],
        )
        state["draft_report"] = response.content
        logger.info("Writer agent completed draft report")
        return state
    except Exception as exc:
        state["error"] = f"Writer agent error: {exc}"
        logger.exception("Writer agent failed")
        return state


async def write_report(summary: str) -> dict:
    """Compatibility wrapper for the initial scaffold orchestrator."""
    state: ResearchState = {
        "query": "",
        "search_results": [],
        "summaries": [summary] if summary else [],
        "draft_report": "",
        "fact_check_notes": [],
        "final_report": "",
        "current_agent": "writer",
        "error": None,
        "metadata": {},
    }
    updated_state = writer_agent(state)
    return {"agent": "writer", "report": updated_state.get("draft_report", "")}
