import { CheckCircle, Clipboard, Download, XCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export default function ReportDisplay({ report, factCheckNotes = [], metadata = {} }) {
  function handleCopy() {
    if (report) {
      navigator.clipboard.writeText(report)
    }
  }

  function handleDownload() {
    if (!report) return

    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'research-report.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">Research Report</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!report}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Clipboard size={16} />
            Copy Report
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!report}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} />
            Download Report
          </button>
        </div>
      </div>

      {report ? (
        <div className="react-markdown prose max-w-none text-slate-800">
          <ReactMarkdown>{report}</ReactMarkdown>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      )}

      {factCheckNotes.length > 0 ? (
        <div className="mt-8 border-t border-slate-200 pt-5">
          <h3 className="mb-4 text-base font-semibold text-slate-950">Fact Check Results</h3>
          <div className="space-y-3">
            {factCheckNotes.map((note, index) => {
              const Icon = note.verified ? CheckCircle : XCircle
              return (
                <div key={`${note.claim}-${index}`} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[24px_1fr_90px_160px]">
                  <Icon size={20} className={note.verified ? 'text-emerald-600' : 'text-rose-600'} />
                  <p className="text-sm text-slate-800">{note.claim}</p>
                  <span className="text-sm font-semibold text-slate-700">{Math.round((note.confidence || 0) * 100)}%</span>
                  <span className="truncate text-sm text-slate-500" title={note.source}>
                    {note.source}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <footer className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-500">
        Sources: {metadata.total_sources || 0} | Processing time: {metadata.processing_time || 0}s | {metadata.timestamp || 'Pending'}
      </footer>
    </section>
  )
}
