"""Researcher agent for collecting web sources."""

import logging
import os
import time
from urllib.parse import urlparse

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

DOCUMENT_ONLY_KEYWORDS = (
    "this pdf",
    "the pdf",
    "this document",
    "the document",
    "uploaded document",
    "uploaded pdf",
    "summarize",
    "summary",
    "explain",
    "review",
    "extract",
    "analyze this",
    "tell me about this",
)

WEB_CONTEXT_KEYWORDS = (
    "latest",
    "current",
    "recent",
    "today",
    "news",
    "market",
    "compare",
    "competitor",
    "web",
    "internet",
    "external",
    "sources",
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


def _fallback_title(url: str, index: int) -> str:
    parsed = urlparse(url or "")
    host = parsed.netloc.replace("www.", "")
    path_parts = [part for part in parsed.path.split("/") if part]

    if path_parts:
        readable_path = path_parts[-1].replace("-", " ").replace("_", " ").strip()
        if readable_path:
            return f"{readable_path.title()} - {host}" if host else readable_path.title()

    return host or f"Source {index}"


def _should_use_web(query: str, uploaded_documents: list[dict], preferences: dict) -> bool:
    source_mode = preferences.get("source_mode", "auto")
    has_documents = any(str(document.get("content", "")).strip() for document in uploaded_documents)
    normalized_query = query.lower()

    if source_mode == "documents_only":
        return False

    if source_mode == "web_and_documents":
        return True

    if has_documents:
        asks_for_web_context = any(keyword in normalized_query for keyword in WEB_CONTEXT_KEYWORDS)
        asks_about_document = any(keyword in normalized_query for keyword in DOCUMENT_ONLY_KEYWORDS)
        if asks_about_document and not asks_for_web_context:
            return False

    return True


def researcher_agent(state: ResearchState) -> ResearchState:
    """Search the web for the user's query and store raw source results."""
    try:
        query = state["query"]
        uploaded_documents = state.get("uploaded_documents", [])
        preferences = state.get("preferences", {})
        use_web = _should_use_web(query, uploaded_documents, preferences)
        state["current_agent"] = "researcher"
        state.setdefault("metadata", {})
        state["metadata"]["search_query_used"] = query
        state["metadata"]["source_mode"] = preferences.get("source_mode", "auto")
        state["metadata"]["web_search_used"] = use_web
        logger.info("Researcher agent started for query: %s", query)

        search_results = []

        if use_web:
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

            for index, result in enumerate(raw_results, start=1):
                title = (result.get("title") or "").strip()
                url = (result.get("url") or "").strip()
                if not title or title.lower() == "untitled source":
                    title = _fallback_title(url, index)

                search_results.append(
                    {
                        "id": index,
                        "title": title,
                        "url": url,
                        "content": result.get("content", ""),
                        "score": result.get("score", 0),
                        "source_type": "web",
                    }
                )

        for document in uploaded_documents:
            content = str(document.get("content", "")).strip()
            title = str(document.get("title", "Uploaded document")).strip() or "Uploaded document"
            if not content:
                continue

            search_results.append(
                {
                    "id": len(search_results) + 1,
                    "title": title,
                    "url": "",
                    "content": content[:30000],
                    "score": 1,
                    "source_type": "document",
                }
            )

        state["search_results"] = search_results
        state["metadata"]["total_sources"] = len(search_results)
        state["metadata"]["uploaded_documents"] = len(uploaded_documents)
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
