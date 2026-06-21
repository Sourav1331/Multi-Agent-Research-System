import { Search } from 'lucide-react'
import { useState } from 'react'

const examples = [
  'Latest AI developments in 2025',
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
    <form onSubmit={submitQuery} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <label htmlFor="research-query" className="mb-2 block text-sm font-semibold text-slate-800">
        Research question
      </label>
      <textarea
        id="research-query"
        value={query}
        onChange={(event) => setQuery(event.target.value.slice(0, 500))}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        maxLength={500}
        rows={5}
        placeholder="What do you want to research? E.g. 'Latest breakthroughs in quantum computing 2025'"
        className="w-full resize-y rounded-lg border border-slate-300 px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-slate-500">{query.length}/500</span>
        <button
          type="submit"
          disabled={isLoading || query.trim().length < 10}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search size={18} />
          {isLoading ? 'Researching' : 'Research'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            disabled={isLoading}
            onClick={() => setQuery(example)}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>
    </form>
  )
}
