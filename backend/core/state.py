"""Shared LangGraph state for the multi-agent research pipeline."""

from typing_extensions import TypedDict


class ResearchState(TypedDict):
    # Original user research question. Set once when the workflow starts and
    # read by every agent without modification.
    query: str

    # Raw Tavily search results collected by the Researcher agent.
    # Expected item keys: title, url, content, score.
    search_results: list[dict]

    # Text documents uploaded by the user for this run.
    # Expected item keys: title, content.
    uploaded_documents: list[dict]

    # User-selected presentation preferences from the frontend.
    # Expected keys: depth, audience, report_style, citation_style.
    preferences: dict

    # Key points extracted from search results by the Summarizer agent.
    summaries: list[str]

    # Initial markdown report produced by the Writer agent.
    # Expected sections: Overview, Key Findings, Details, Conclusion.
    draft_report: str

    # Claim verification records produced by the Fact-checker agent.
    # Expected item keys: claim, verified, confidence, source.
    fact_check_notes: list[dict]

    # Final polished report after fact-checking corrections are applied.
    final_report: str

    # Currently active agent for frontend progress updates.
    # Values: researcher, summarizer, writer, fact_checker, complete.
    current_agent: str

    # Error message if any agent fails. None means the workflow is healthy.
    error: str | None

    # Extra workflow information such as total_sources, processing_time,
    # search_query_used, and timestamp.
    metadata: dict


def initial_state(query: str, preferences: dict | None = None) -> ResearchState:
    """Create a fresh research workflow state for a user query."""
    normalized_preferences = preferences or {}
    return {
        "query": query,
        "search_results": [],
        "uploaded_documents": [],
        "preferences": normalized_preferences,
        "summaries": [],
        "draft_report": "",
        "fact_check_notes": [],
        "final_report": "",
        "current_agent": "researcher",
        "error": None,
        "metadata": {
            "total_sources": 0,
            "processing_time": 0.0,
            "search_query_used": "",
            "timestamp": "",
            "preferences": normalized_preferences,
        },
    }
