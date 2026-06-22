"""Writer agent for producing the draft research report."""

import logging
import os
import time
from urllib.parse import urlparse

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


PREFERENCE_LABELS = {
    "depth": {
        "quick": "Keep the report concise and prioritize the highest-signal findings.",
        "balanced": "Balance depth with readability and include meaningful context.",
        "deep": "Go deeper on nuance, tradeoffs, and implications while staying evidence-bound.",
    },
    "audience": {
        "executive": "Write for an executive audience: direct, outcome-oriented, and decision-ready.",
        "technical": "Write for a technical audience: include implementation details and precise terminology.",
        "general": "Write for a general informed audience: explain jargon and keep the structure easy to scan.",
    },
    "report_style": {
        "brief": "Use a compact brief format with short sections.",
        "standard": "Use a standard research report format.",
        "decision_memo": "Use a decision memo format with recommendations and risks.",
    },
    "citation_style": {
        "numbered": "Cite evidence with numbered citations like [1] or [2].",
        "inline_titles": "Cite evidence by naming the source title inline.",
    },
}


def _invoke_with_retry(llm, messages):
    for attempt in range(3):
        try:
            return llm.invoke(messages)
        except Exception as exc:
            if "429" in str(exc) and attempt < 2:
                time.sleep(2**attempt)
            else:
                raise


def _source_title(result: dict, index: int) -> str:
    title = (result.get("title") or "").strip()
    if title and title.lower() != "untitled source":
        return title

    url = (result.get("url") or "").strip()
    parsed = urlparse(url)
    host = parsed.netloc.replace("www.", "")
    path_parts = [part for part in parsed.path.split("/") if part]
    if path_parts:
        return f"{path_parts[-1].replace('-', ' ').replace('_', ' ').title()} - {host}"
    return host or f"Source {index}"


def writer_agent(state: ResearchState) -> ResearchState:
    """Write a structured markdown draft report from source summaries."""
    try:
        state["current_agent"] = "writer"
        query = state["query"]
        summaries = state.get("summaries", [])
        search_results = state.get("search_results", [])
        preferences = state.get("preferences", {})
        document_sources = [result for result in search_results if result.get("source_type") == "document"]
        web_sources = [result for result in search_results if result.get("source_type") == "web"]
        is_document_focused = bool(document_sources) and not web_sources
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
            f"[{result.get('id', index)}] {_source_title(result, index)}"
            f"{' - ' + result.get('url', '') if result.get('url') else ' - uploaded document'}"
            f"\nSnippet: {result.get('content', '')[:700]}"
            for index, result in enumerate(search_results, start=1)
        )
        if is_document_focused:
            structure_prompt = (
                "Structure the report with these sections:\n"
                "## Document Summary\n"
                "## Key Details\n"
                "## Important Dates and Instructions\n"
                "## Notes\n\n"
                "For uploaded documents, prioritize extracting the actual useful fields from the document. "
                "If it is an admit card, include candidate name, roll/registration/application number, exam name, date, time, venue/address, reporting instructions, and issuing authority when present. "
                "If any expected field is not found, write 'Not found in the extracted document text.' "
            )
        else:
            structure_prompt = (
                "Structure the report with these sections:\n"
                "## Overview\n"
                "## Key Findings\n"
                "## Detailed Analysis\n"
                "## Conclusion\n\n"
            )

        human_prompt = (
            f"Write a comprehensive research report on: {query}\n\n"
            "Report preferences:\n"
            f"- {PREFERENCE_LABELS['depth'].get(preferences.get('depth'), PREFERENCE_LABELS['depth']['balanced'])}\n"
            f"- {PREFERENCE_LABELS['audience'].get(preferences.get('audience'), PREFERENCE_LABELS['audience']['general'])}\n"
            f"- {PREFERENCE_LABELS['report_style'].get(preferences.get('report_style'), PREFERENCE_LABELS['report_style']['standard'])}\n"
            f"- {PREFERENCE_LABELS['citation_style'].get(preferences.get('citation_style'), PREFERENCE_LABELS['citation_style']['numbered'])}\n\n"
            "Available source catalog:\n"
            f"{source_catalog}\n\n"
            "Based on these key findings:\n"
            f"{chr(10).join(summaries)}\n\n"
            f"{structure_prompt}"
            "Use markdown formatting and follow the selected citation preference using the source catalog. "
            "Put citations directly beside the claims they support, such as '... market growth [1].' "
            "Include citations in the Overview, Key Findings, and Detailed Analysis sections. "
            "Never create a standalone raw citation list of URLs in the report body. "
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
