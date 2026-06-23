"""Summarizer agent for extracting key points from search results."""

import logging
import os
import re
import time

from langchain_groq import ChatGroq

from core.state import ResearchState

logger = logging.getLogger(__name__)

MAX_WEB_CONTENT_CHARS = 6000
MAX_DOCUMENT_CONTENT_CHARS = 12000
DEFAULT_LLM_TIMEOUT_SECONDS = 25

FIELD_LABELS = (
    "name",
    "candidate name",
    "father",
    "mother",
    "roll",
    "registration",
    "application",
    "admit card",
    "exam",
    "date",
    "time",
    "venue",
    "centre",
    "center",
    "address",
    "shift",
    "reporting",
    "category",
    "gender",
    "dob",
    "date of birth",
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


def _research_docs_vector_store(embeddings):
    import chromadb
    from langchain_community.vectorstores import Chroma

    client = chromadb.PersistentClient(path="./chroma_db")
    client.get_or_create_collection("research_docs")
    return Chroma(
        collection_name="research_docs",
        embedding_function=embeddings,
        persist_directory="./chroma_db",
        client=client,
    )


def _llm_timeout_seconds() -> int:
    try:
        return max(5, min(60, int(os.getenv("SUMMARY_LLM_TIMEOUT_SECONDS", DEFAULT_LLM_TIMEOUT_SECONDS))))
    except ValueError:
        return DEFAULT_LLM_TIMEOUT_SECONDS


def _should_use_llm_summarizer() -> bool:
    return os.getenv("USE_LLM_SUMMARIZER", "").strip().lower() in {"1", "true", "yes", "on"}


def _trim_content(content: str, source_type: str) -> str:
    max_chars = MAX_DOCUMENT_CONTENT_CHARS if source_type == "document" else MAX_WEB_CONTENT_CHARS
    if len(content) <= max_chars:
        return content
    return f"{content[:max_chars]}\n\n[Content trimmed for faster summarization.]"


def _should_persist_summaries() -> bool:
    return os.getenv("ENABLE_CHROMA_PERSISTENCE", "").strip().lower() in {"1", "true", "yes", "on"}


def _persist_summaries(summaries: list[str], metadatas: list[dict]) -> None:
    if not summaries:
        return

    from langchain_huggingface import HuggingFaceEmbeddings

    logger.info("Loading embedding model for Chroma persistence")
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vector_store = _research_docs_vector_store(embeddings)
    vector_store.add_texts(texts=summaries, metadatas=metadatas)


def _source_metadata(result: dict) -> dict:
    return {"source_url": result.get("url", ""), "title": result.get("title", "Untitled source")}


def _simple_source_summary(query: str, result: dict) -> str:
    title = result.get("title", "Untitled source")
    source_type = result.get("source_type", "web")
    content = _trim_content(str(result.get("content", "")), source_type)

    if source_type == "document":
        likely_fields = _extract_likely_fields(content)
        if likely_fields:
            return f"Source: {title}\nKey extracted document fields:\n{likely_fields}"

    cleaned = re.sub(r"\s+", " ", content).strip()
    if not cleaned:
        return f"Source: {title}\nNo readable content was found for this source."

    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    selected = [sentence.strip() for sentence in sentences if len(sentence.strip()) > 40][:4]
    if not selected:
        selected = [cleaned[:900]]

    bullets = "\n".join(f"- {sentence[:500]}" for sentence in selected)
    return f"Source: {title}\nRelevant points for '{query}':\n{bullets}"


def _summarize_result_with_llm(llm: ChatGroq, query: str, answer_focus: str, result: dict) -> tuple[str, dict]:
    title = result.get("title", "Untitled source")
    content = _trim_content(str(result.get("content", "")), result.get("source_type", "web"))
    source_type = result.get("source_type", "web")
    text_block = f"{title}\n\n{content}"
    prompt = _summary_prompt(query, title, text_block, source_type, answer_focus)
    response = _invoke_with_retry(llm, prompt)
    return response.content.strip(), _source_metadata(result)


def _summarize_result(query: str, answer_focus: str, result: dict) -> tuple[str, dict]:
    if not _should_use_llm_summarizer():
        return _simple_source_summary(query, result), _source_metadata(result)

    llm = ChatGroq(
        model="llama-3.1-8b-instant",
        temperature=0.2,
        groq_api_key=os.getenv("GROQ_API_KEY"),
        request_timeout=_llm_timeout_seconds(),
        max_retries=0,
    )

    try:
        return _summarize_result_with_llm(llm, query, answer_focus, result)
    except Exception as exc:
        logger.warning("LLM summarization failed for %s; using fast fallback: %s", result.get("title", "source"), exc)
        return _simple_source_summary(query, result), _source_metadata(result)


def _extract_likely_fields(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    extracted: list[str] = []

    for index, line in enumerate(lines):
        normalized = line.lower()
        if not any(label in normalized for label in FIELD_LABELS):
            continue

        if ":" in line:
            extracted.append(line)
            continue

        next_line = lines[index + 1] if index + 1 < len(lines) else ""
        previous_line = lines[index - 1] if index > 0 else ""
        if next_line and not any(label in next_line.lower() for label in FIELD_LABELS):
            extracted.append(f"{line}: {next_line}")
        elif previous_line and not any(label in previous_line.lower() for label in FIELD_LABELS):
            extracted.append(f"{line}: {previous_line}")
        else:
            extracted.append(line)

    deduped = list(dict.fromkeys(extracted))
    return "\n".join(deduped[:60])


def _focus_instruction(answer_focus: str) -> str:
    if answer_focus == "summary":
        return "Prioritize a concise plain-language summary before listing fields."
    if answer_focus == "action_points":
        return "Prioritize actionable next steps, deadlines, required documents, warnings, and checklist items."
    return "Prioritize exact key fields and values, especially names, IDs, dates, venues, and document-specific details."


def _summary_prompt(query: str, title: str, text_block: str, source_type: str, answer_focus: str) -> str:
    if source_type == "document":
        likely_fields = _extract_likely_fields(text_block)
        return (
            f"Analyze this uploaded document for the user request: '{query}'.\n"
            f"Source: {title}\n\n"
            f"Answer focus: {_focus_instruction(answer_focus)}\n\n"
            f"Likely extracted document fields:\n{likely_fields or 'No obvious fields extracted.'}\n\n"
            "Extract the actual document content, not only file metadata. Identify:\n"
            "- Document type or purpose, such as admit card, invoice, resume, certificate, report, notice, etc.\n"
            "- Person or candidate details, such as name, roll number, registration number, application number, date of birth, category, or contact details if present.\n"
            "- Event/exam/organization details, such as exam name, post/course, issuing authority, date, time, venue, address, reporting time, and instructions if present.\n"
            "- Any important warnings, deadlines, eligibility details, or next actions.\n\n"
            "If the document text contains a 'PDF form fields and annotations' section, treat those fields as high-priority candidate/person details. "
            "If the text contains 'Raw positioned text items', use them to recover fields that were not reconstructed cleanly in normal lines. "
            "Before saying a field is not found, carefully inspect all extracted lines for nearby label/value pairs, table-like text, and values split across lines. "
            "Do not treat generated/access metadata such as IP address or browser access time as the main document content unless the document is actually about access logs. "
            "Use only information present in the document. If a field is truly absent from the extracted text, say it is not found in the extracted text. "
            "Format as concise bullet points grouped by topic, and include exact extracted values when available.\n\n"
            f"Document text:\n{text_block}"
        )

    return (
        f"Extract the 3 most important factual points from this source about '{query}'.\n"
        f"Answer focus: {_focus_instruction(answer_focus)}\n"
        f"Format as bullet points. Source: {title}\n\n{text_block}"
    )


def summarizer_agent(state: ResearchState) -> ResearchState:
    """Summarize each search result and persist summary chunks to ChromaDB."""
    try:
        state["current_agent"] = "summarizer"
        query = state["query"]
        answer_focus = state.get("preferences", {}).get("answer_focus", "key_details")
        search_results = state.get("search_results", [])
        logger.info("Summarizer agent started with %s sources", len(search_results))

        if not search_results:
            state["error"] = "No search results to summarize"
            logger.warning("Summarizer agent stopped: no search results")
            return state

        summarized_results = [_summarize_result(query, answer_focus, result) for result in search_results]

        summaries = [summary for summary, _metadata in summarized_results]
        metadatas = [metadata for _summary, metadata in summarized_results]

        if _should_persist_summaries():
            _persist_summaries(summaries, metadatas)
        else:
            logger.info("Skipped Chroma persistence; set ENABLE_CHROMA_PERSISTENCE=true to enable it")

        state["summaries"] = summaries
        logger.info("Summarizer agent created %s summaries", len(summaries))
        return state
    except Exception as exc:
        state["error"] = f"Summarizer agent error: {exc}"
        logger.exception("Summarizer agent failed")
        return state


async def summarize(findings: list) -> dict:
    """Compatibility wrapper for the initial scaffold orchestrator."""
    state: ResearchState = {
        "query": "",
        "search_results": findings,
        "summaries": [],
        "draft_report": "",
        "fact_check_notes": [],
        "final_report": "",
        "current_agent": "summarizer",
        "error": None,
        "metadata": {},
    }
    updated_state = summarizer_agent(state)
    return {
        "agent": "summarizer",
        "summary": "\n".join(updated_state.get("summaries", [])),
        "source_count": len(findings),
    }
