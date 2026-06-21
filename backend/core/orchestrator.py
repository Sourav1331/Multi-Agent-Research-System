"""LangGraph orchestration entry point."""

from agents.researcher import research
from agents.summarizer import summarize
from agents.writer import write_report
from agents.fact_checker import fact_check


async def run_research(query: str) -> dict:
    research_result = await research(query)
    summary_result = await summarize(research_result["findings"])
    writer_result = await write_report(summary_result["summary"])
    fact_check_result = await fact_check(writer_result["report"])

    return {
        "query": query,
        "steps": [
            research_result,
            summary_result,
            writer_result,
            fact_check_result,
        ],
        "report": fact_check_result["report"],
        "verified": fact_check_result["verified"],
    }
