"""Summarizer agent placeholder."""


async def summarize(findings: list) -> dict:
    return {"agent": "summarizer", "summary": "", "source_count": len(findings)}
