import { ArrowRight, Search, Wand2 } from 'lucide-react'
import { useState } from 'react'

const examples = [
  'Latest AI developments in 2026',
  'Climate change solutions being implemented',
  'Best practices in microservices architecture',
]

export default function QueryInput({ onSubmit, isLoading }) {
  const [query, setQuery] = useState('')

  function submitQuery(event) {
    event.preventDefault()
    const cleaned = query.trim()
    if (!cleaned || isLoading) return
    onSubmit(cleaned)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      submitQuery(event)
    }
  }

  return (
    <form onSubmit={submitQuery} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
        className="min-h-32 w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50/60 px-4 py-3 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:bg-zinc-950 dark:focus:ring-blue-950"
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Wand2 size={16} />
          Press Enter to submit, Shift+Enter for a new line.
        </div>
        <button
          type="submit"
          disabled={isLoading || query.trim().length < 10}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-zinc-950 px-5 font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <ArrowRight size={18} />
          {isLoading ? 'Researching' : 'Research'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            disabled={isLoading}
            onClick={() => setQuery(example)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-blue-500 dark:hover:bg-blue-950 dark:hover:text-blue-200"
          >
            {example}
          </button>
        ))}
      </div>
    </form>
  )
}
