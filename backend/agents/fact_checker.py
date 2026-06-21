"""Fact-checker agent for validating and finalizing reports."""

import ast
import json
import logging
import os
import re
import time

from langchain_groq import ChatGroq

from core.state import ResearchState

logger = logging.getLogger(__name__)


def _invoke_with_retry(llm, messages):
    for attempt in range(3):
        try:
            return llm.invoke(messages)
        except Exception as exc:
            if "429" in str(exc) and attempt < 2:
                time.sleep(2**attempt)
            else:
                raise


def _parse_fact_check_json(content: str) -> list[dict]:
    """Parse a JSON array even if the model wraps it in markdown fences."""
    cleaned = re.sub(r"```json|```", "", content).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return ast.literal_eval(cleaned)


def _strip_generated_references(report: str) -> str:
    """Remove model-generated source sections so verified sources can be appended."""
    return re.sub(
        r"\n{0,2}(?:#{1,3}\s*)?(?:references|sources)\s*\n[-=]*\n?.*$",
        "",
        report.strip(),
        flags=re.IGNORECASE | re.DOTALL | re.MULTILINE,
    ).strip()


def _format_verified_sources(search_results: list[dict]) -> str:
    seen: set[str] = set()
    lines: list[str] = []

    for result in search_results:
        title = (result.get("title") or "Untitled source").strip()
        url = (result.get("url") or "").strip()
        key = (url or title).lower()

        if not key or key in seen:
            continue

        seen.add(key)
        if url:
            lines.append(f"- [{title}]({url})")
        else:
            lines.append(f"- {title}")

    if not lines:
        return ""

    return "## Sources\n\n" + "\n".join(lines)


def fact_checker_agent(state: ResearchState) -> ResearchState:
    """Verify draft claims against summaries and produce the final report."""
    try:
        state["current_agent"] = "fact_checker"
        draft_report = state.get("draft_report", "")
        summaries = state.get("summaries", [])
        search_results = state.get("search_results", [])
        logger.info("Fact-checker agent started")

        if not draft_report:
            state["error"] = "No draft report to fact-check"
            logger.warning("Fact-checker agent stopped: no draft report")
            return state

        llm = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.0,
            groq_api_key=os.getenv("GROQ_API_KEY"),
        )

        sources_summary = "\n\n".join(summaries)
        source_titles = "\n".join(
            f"- {result.get('title', 'Untitled source')}: {result.get('url', '')}"
            for result in search_results
        )
        fact_check_prompt = (
            "You are a fact-checker. Review this research report and identify 5 key claims.\n"
            "For each claim, check if it is supported by the provided sources.\n\n"
            f"Report to check:\n{draft_report}\n\n"
            f"Original sources summary:\n{sources_summary}\n\n"
            f"Available source titles and URLs:\n{source_titles}\n\n"
            "For each claim respond in this exact JSON format:\n"
            "[\n"
            "  {\n"
            "    \"claim\": \"the claim text\",\n"
            "    \"verified\": true,\n"
            "    \"confidence\": 0.0,\n"
            "    \"source\": \"source title or URL that supports/refutes this\"\n"
            "  }\n"
            "]\n"
            "Return ONLY the JSON array, nothing else."
        )

        response = _invoke_with_retry(llm, fact_check_prompt)
        fact_check_notes = _parse_fact_check_json(response.content)
        state["fact_check_notes"] = fact_check_notes

        unverified_claims = [note for note in fact_check_notes if not note.get("verified", False)]
        if unverified_claims:
            revision_prompt = (
                "Revise this draft report so unsupported or low-confidence claims are corrected "
                "or removed. Use only the provided source summaries. "
                "Do not add a References or Sources section.\n\n"
                f"Draft report:\n{draft_report}\n\n"
                f"Unsupported claims:\n{json.dumps(unverified_claims, indent=2)}\n\n"
                f"Source summaries:\n{sources_summary}"
            )
            revision = _invoke_with_retry(llm, revision_prompt)
            final_report = revision.content
        else:
            final_report = draft_report

        cleaned_report = _strip_generated_references(final_report)
        verified_sources = _format_verified_sources(search_results)
        total = len(fact_check_notes)
        verified_count = total - len(unverified_claims)
        state["final_report"] = (
            f"{cleaned_report}\n\n{verified_sources}\n\n---\n"
            f"*Fact-check complete. {verified_count}/{total} claims verified.*"
        )
        state["current_agent"] = "complete"
        logger.info("Fact-checker agent completed with %s/%s verified claims", verified_count, total)
        return state
    except Exception as exc:
        state["error"] = f"Fact-checker agent error: {exc}"
        logger.exception("Fact-checker agent failed")
        return state


async def fact_check(report: str) -> dict:
    """Compatibility wrapper for the initial scaffold orchestrator."""
    state: ResearchState = {
        "query": "",
        "search_results": [],
        "summaries": [],
        "draft_report": report,
        "fact_check_notes": [],
        "final_report": "",
        "current_agent": "fact_checker",
        "error": None,
        "metadata": {},
    }
    updated_state = fact_checker_agent(state)
    return {
        "agent": "fact_checker",
        "verified": updated_state.get("error") is None,
        "report": updated_state.get("final_report", report),
    }
