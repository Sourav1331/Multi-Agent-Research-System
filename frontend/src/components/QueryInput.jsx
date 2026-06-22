import { ArrowRight, FileUp, Search, Sparkles, Target, X, Waypoints } from 'lucide-react'
import { useState } from 'react'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

const examples = [
  { label: 'Market scan', query: 'Analyze the current market landscape for AI coding assistants in 2026' },
  { label: 'Risk memo', query: 'Research supply chain cybersecurity risks for mid-sized SaaS companies' },
  { label: 'Tech brief', query: 'Compare modern vector database options for retrieval augmented generation' },
]

const sourceModeOptions = [
  { value: 'auto', label: 'Auto' },
  { value: 'documents_only', label: 'Docs only' },
  { value: 'web_and_documents', label: 'Web + docs' },
]

export default function QueryInput({ onSubmit, isLoading }) {
  const [query, setQuery] = useState('')
  const [documents, setDocuments] = useState([])
  const [uploadError, setUploadError] = useState('')
  const [isReadingFiles, setIsReadingFiles] = useState(false)
  const [preferences, setPreferences] = useState({
    depth: 'balanced',
    audience: 'general',
    report_style: 'standard',
    citation_style: 'numbered',
    source_mode: 'auto',
  })

  function submitQuery(event) {
    event.preventDefault()
    const cleaned = query.trim()
    if (!cleaned || isLoading) return
    onSubmit(cleaned, documents, preferences)
  }

  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  async function readPdfText(file) {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    const data = new Uint8Array(await file.arrayBuffer())
    const pdf = await pdfjsLib.getDocument({ data }).promise
    const pages = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const annotations = await page.getAnnotations()
      const rows = new Map()
      const rawItems = []

      textContent.items.forEach((item) => {
        const text = item.str?.trim()
        if (!text) return

        const [, , , , x, y] = item.transform
        rawItems.push(`[x:${Math.round(x)} y:${Math.round(y)}] ${text}`)
        const rowKey = Math.round(y / 4) * 4
        const row = rows.get(rowKey) || []
        row.push({ x, text })
        rows.set(rowKey, row)
      })

      const pageText = Array.from(rows.entries())
        .sort(([firstY], [secondY]) => secondY - firstY)
        .map(([, row]) =>
          row
            .sort((first, second) => first.x - second.x)
            .map((item) => item.text)
            .join(' ')
        )
        .join('\n')

      const annotationText = annotations
        .map((annotation) => {
          const label = annotation.fieldName || annotation.alternativeText || annotation.contentsObj?.str || annotation.subtype || ''
          const value = annotation.fieldValue || annotation.buttonValue || annotation.contents || ''
          const cleanedLabel = String(label).trim()
          const cleanedValue = String(value).trim()

          if (cleanedLabel && cleanedValue) return `${cleanedLabel}: ${cleanedValue}`
          if (cleanedValue) return cleanedValue
          if (cleanedLabel) return cleanedLabel
          return ''
        })
        .filter(Boolean)
        .join('\n')

      pages.push(
        [
          `--- Page ${pageNumber} ---`,
          pageText ? `Reconstructed lines:\n${pageText}` : '',
          annotationText ? `PDF form fields and annotations:\n${annotationText}` : '',
          rawItems.length ? `Raw positioned text items:\n${rawItems.join('\n')}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      )
    }

    return pages.join('\n\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  }

  async function readDocument(file) {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const content = await readPdfText(file)
      return {
        title: file.name,
        content,
      }
    }

    return {
      title: file.name,
      content: await file.text(),
    }
  }

  async function handleFiles(event) {
    setUploadError('')
    setIsReadingFiles(true)

    try {
      const files = Array.from(event.target.files || []).slice(0, 5)
      const loaded = await Promise.all(
        files.map(async (file) => {
          const document = await readDocument(file)
          return {
            title: document.title,
            content: document.content.slice(0, 30000),
          }
        })
      )
      const usableDocuments = loaded.filter((document) => document.content.trim())

      if (usableDocuments.length !== loaded.length) {
        setUploadError('One or more files did not contain extractable text.')
      }

      setDocuments((current) => [...current, ...usableDocuments].slice(0, 5))
      event.target.value = ''
    } catch (error) {
      setUploadError(error.message || 'Unable to read the selected file.')
    } finally {
      setIsReadingFiles(false)
    }
  }

  function removeDocument(title) {
    setDocuments((current) => current.filter((document) => document.title !== title))
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      submitQuery(event)
    }
  }

  return (
    <form onSubmit={submitQuery} className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-5 border-b border-zinc-100 p-5 dark:border-zinc-800 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="research-query" className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Search size={16} className="text-blue-600 dark:text-blue-400" />
              Research question
            </label>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{query.length}/500</span>
          </div>
      <textarea
        id="research-query"
        value={query}
        onChange={(event) => setQuery(event.target.value.slice(0, 500))}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        maxLength={500}
        rows={5}
        placeholder="What do you want to research? E.g. 'Latest breakthroughs in quantum computing 2025'"
        className="min-h-36 w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50/60 px-4 py-3 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:bg-zinc-950 dark:focus:ring-blue-950"
      />

          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example.label}
                type="button"
                disabled={isLoading}
                onClick={() => setQuery(example.query)}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-blue-500 dark:hover:bg-blue-950 dark:hover:text-blue-200"
              >
                <Sparkles size={14} />
                {example.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Target size={16} className="text-amber-600 dark:text-amber-400" />
            Research mode
          </div>

          <div className="space-y-3">
            <OptionGroup icon={Waypoints} label="Sources" options={sourceModeOptions} value={preferences.source_mode} onChange={(value) => updatePreference('source_mode', value)} disabled={isLoading} />
            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Auto uses uploaded documents only for PDF/file summaries and adds web search when the question needs outside context.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            <FileUp size={16} className="text-emerald-600 dark:text-emerald-400" />
            Upload documents
          </div>
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
            Choose files
            <input
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.log,.pdf,application/pdf"
              onChange={handleFiles}
              disabled={isLoading || isReadingFiles}
              className="sr-only"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Supports PDF and text-like files up to 5 documents. Uploaded text is used as an extra research source.
        </p>
        {isReadingFiles ? <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-300">Extracting document text...</p> : null}
        {uploadError ? <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">{uploadError}</p> : null}
        {documents.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {documents.map((document) => (
              <span key={document.title} title={document.content.slice(0, 500)} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700">
                {document.title}
                <button type="button" onClick={() => removeDocument(document.title)} className="text-zinc-400 hover:text-rose-600" aria-label={`Remove ${document.title}`}>
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

        <button
          type="submit"
          disabled={isLoading || isReadingFiles || query.trim().length < 10}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-6 font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 lg:self-end"
        >
          <ArrowRight size={18} />
          {isLoading ? 'Researching' : 'Launch research'}
        </button>
      </div>
    </form>
  )
}

function OptionGroup({ icon: Icon, label, options, value, onChange, disabled }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400">
        <Icon size={14} />
        {label}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`min-h-9 rounded-lg border px-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-blue-500'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
