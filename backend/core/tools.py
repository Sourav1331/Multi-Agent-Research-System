"""External tools available to LangChain/LangGraph agents."""

import contextlib
import io
import time

import chromadb
from dotenv import load_dotenv
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_community.vectorstores import Chroma
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings

load_dotenv()


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


@tool("web_search")
def web_search_tool(query: str) -> list[dict] | str:
    """Search the web for recent information on a topic. Returns top 5 results with title, URL, and content snippet."""
    try:
        search = TavilySearchResults(max_results=5, search_depth="advanced")
        results = search.invoke({"query": query})

        return [
            {
                "title": result.get("title", ""),
                "url": result.get("url", ""),
                "content": result.get("content", ""),
                "score": result.get("score", 0),
            }
            for result in results
        ]
    except Exception as exc:
        return f"web_search error: {exc}"


@tool("retrieve_from_documents")
def document_retrieval_tool(query: str, n_results: int = 5) -> list[str] | str:
    """Retrieve semantically relevant chunks from stored documents using vector similarity search."""
    try:
        print("Loading embedding model... (first run takes 1-2 minutes)")
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        print("Embedding model loaded.")
        vector_store = _research_docs_vector_store(embeddings)
        documents = vector_store.similarity_search(query, k=n_results)
        return [document.page_content for document in documents]
    except Exception as exc:
        return f"retrieve_from_documents error: {exc}"


@tool("python_calculator")
def python_repl_tool(code: str) -> str:
    """Execute simple Python expressions for calculations or data processing. Only use for math and simple logic, not file I/O."""
    blocked_patterns = ("import os", "import sys", "open(", "__import__")

    try:
        if any(pattern in code for pattern in blocked_patterns):
            return "python_calculator error: blocked unsafe code"

        output = io.StringIO()
        safe_globals = {
            "__builtins__": {
                "abs": abs,
                "len": len,
                "max": max,
                "min": min,
                "pow": pow,
                "print": print,
                "range": range,
                "round": round,
                "sum": sum,
            }
        }
        safe_locals: dict = {}

        with contextlib.redirect_stdout(output):
            exec(code, safe_globals, safe_locals)

        result = output.getvalue().strip()
        if result:
            return result

        return str(safe_locals.get("_", ""))
    except Exception as exc:
        return f"python_calculator error: {exc}"


@tool("summarize_text")
def summarize_text_tool(text: str, max_points: int = 5) -> str:
    """Summarize a long piece of text into concise key points as a bullet list."""
    try:
        llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0)
        prompt = (
            f"Summarize the following text into exactly {max_points} key bullet points. "
            f"Be concise and factual:\n\n{text}"
        )
        response = _invoke_with_retry(llm, prompt)
        return response.content
    except Exception as exc:
        return f"summarize_text error: {exc}"


def get_all_tools() -> list:
    """Return every tool available to the agent graph."""
    return [
        web_search_tool,
        document_retrieval_tool,
        python_repl_tool,
        summarize_text_tool,
    ]
