import { CheckCircle, Clipboard, Download, ExternalLink, FileDown, XCircle } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

export default function ReportDisplay({ report, factCheckNotes = [], metadata = {}, sources = [] }) {
  const [showSources, setShowSources] = useState(true)

  const visibleSources = sources.filter((source) => source?.title)

  function handleCopy() {
    if (report) {
      navigator.clipboard.writeText(report)
    }
  }

  function handleDownloadMarkdown() {
    if (!report) return

    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'research-report.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleDownloadPdf() {
    if (!report) return

    const reportNode = document.querySelector('[data-report-print]')
    if (!reportNode) return

    const printWindow = window.open('', '_blank', 'width=960,height=720')
    if (!printWindow) return

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>research-report</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #ffffff;
              color: #27272a;
              font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              font-size: 14px;
              line-height: 1.65;
            }
            main { max-width: 820px; margin: 0 auto; padding: 32px; }
            h1, h2, h3 { color: #09090b; line-height: 1.25; }
            h1 { font-size: 26px; margin: 0 0 18px; }
            h2 { margin: 24px 0 10px; border-bottom: 1px solid #e4e4e7; padding-bottom: 8px; font-size: 20px; }
            h3 { margin: 20px 0 8px; font-size: 16px; }
            p { margin: 0 0 12px; }
            ul, ol { margin: 10px 0 14px 22px; padding: 0; }
            li { margin-bottom: 5px; }
            code { border-radius: 6px; background: #f4f4f5; padding: 2px 5px; font-size: 0.92em; }
            pre { overflow-wrap: break-word; white-space: pre-wrap; border-radius: 8px; background: #f4f4f5; padding: 14px; }
            .fact-check-section { margin-top: 28px; border-top: 1px solid #e4e4e7; padding-top: 18px; }
            .fact-check-row { display: grid; grid-template-columns: 1fr 70px 160px; gap: 12px; border: 1px solid #e4e4e7; border-radius: 8px; padding: 10px; margin-bottom: 8px; }
            .verified { color: #047857; font-weight: 700; }
            .unverified { color: #be123c; font-weight: 700; }
            footer { margin-top: 24px; border-top: 1px solid #e4e4e7; padding-top: 12px; color: #71717a; font-size: 12px; }
            @page { margin: 18mm; }
          </style>
        </head>
        <body>
          <main>${reportNode.innerHTML}</main>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Research Report</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Formatted output ready for review and export.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowSources((current) => !current)}
            disabled={visibleSources.length === 0}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Sources
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!report}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Clipboard size={16} />
            Copy
          </button>
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            disabled={!report}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Download size={16} />
            Markdown
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!report}
            title="Export PDF"
            className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <FileDown size={16} />
            PDF
          </button>
        </div>
      </div>

      <div data-report-print className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
        {report ? (
          <div className="react-markdown prose max-w-none text-zinc-800 dark:text-zinc-200">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-28 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          </div>
        )}

        {showSources && visibleSources.length > 0 ? (
          <div className="mt-8 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <h3 className="mb-4 text-base font-semibold text-zinc-950 dark:text-zinc-50">Source Viewer</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {visibleSources.map((source, index) => (
                <article key={`${source.url || source.title}-${index}`} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">[{source.id || index + 1}] {source.source_type === 'document' ? 'Uploaded document' : 'Web source'}</p>
                      <h4 className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{source.title}</h4>
                    </div>
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800 dark:hover:text-blue-300" aria-label={`Open ${source.title}`}>
                        <ExternalLink size={16} />
                      </a>
                    ) : null}
                  </div>
                  <p className="line-clamp-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{source.content || 'No snippet available.'}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {factCheckNotes.length > 0 ? (
          <div className="fact-check-section mt-8 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <h3 className="mb-4 text-base font-semibold text-zinc-950 dark:text-zinc-50">Fact Check Results</h3>
            <div className="space-y-3">
              {factCheckNotes.map((note, index) => {
                const Icon = note.verified ? CheckCircle : XCircle
                return (
                  <div
                    key={`${note.claim}-${index}`}
                    className="fact-check-row grid gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[24px_1fr_90px_160px]"
                  >
                    <Icon size={20} className={note.verified ? 'text-emerald-600' : 'text-rose-600'} />
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">{note.claim}</p>
                    <span className={`text-sm font-semibold ${note.verified ? 'verified text-emerald-700' : 'unverified text-rose-700'}`}>
                      {Math.round((note.confidence || 0) * 100)}%
                    </span>
                    <span className="truncate text-sm text-zinc-500 dark:text-zinc-400" title={note.source}>
                      {note.source}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        <footer className="mt-6 border-t border-zinc-200 pt-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Sources: {metadata.total_sources || 0} | Processing time: {metadata.processing_time || 0}s | {metadata.timestamp || 'Pending'}
        </footer>
      </div>
    </section>
  )
}
