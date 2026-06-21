"""Summarizer agent for extracting key points from search results."""

import logging
import os
import time

import chromadb
from langchain_community.vectorstores import Chroma
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings

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


def _research_docs_vector_store(embeddings: HuggingFaceEmbeddings) -> Chroma:
    client = chromadb.PersistentClient(path="./chroma_db")
    client.get_or_create_collection("research_docs")
    return Chroma(
        collection_name="research_docs",
        embedding_function=embeddings,
        persist_directory="./chroma_db",
        client=client,
    )


def summarizer_agent(state: ResearchState) -> ResearchState:
    """Summarize each search result and persist summary chunks to ChromaDB."""
    try:
        state["current_agent"] = "summarizer"
        query = state["query"]
        search_results = state.get("search_results", [])
        logger.info("Summarizer agent started with %s sources", len(search_results))

        if not search_results:
            state["error"] = "No search results to summarize"
            logger.warning("Summarizer agent stopped: no search results")
            return state

        llm = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.2,
            groq_api_key=os.getenv("GROQ_API_KEY"),
        )

        summaries: list[str] = []
        metadatas: list[dict] = []
        for result in search_results:
            title = result.get("title", "Untitled source")
            content = result.get("content", "")
            text_block = f"{title}\n\n{content}"
            prompt = (
                f"Extract the 3 most important factual points from this source about '{query}'.\n"
                f"Format as bullet points. Source: {title}\n\n{text_block}"
            )
            response = _invoke_with_retry(llm, prompt)
            summary = response.content.strip()
            summaries.append(summary)
            metadatas.append({"source_url": result.get("url", ""), "title": title})

        print("Loading embedding model... (first run takes 1-2 minutes)")
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        print("Embedding model loaded.")
        vector_store = _research_docs_vector_store(embeddings)
        vector_store.add_texts(texts=summaries, metadatas=metadatas)

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
