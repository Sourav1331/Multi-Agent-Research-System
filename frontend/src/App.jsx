import { Activity, Clock, FileSearch, Moon, Sparkles, Sun, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import AgentProgress from './components/AgentProgress'
import QueryInput from './components/QueryInput'
import ReportDisplay from './components/ReportDisplay'

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || ''

const agents = ['researcher', 'summarizer', 'writer', 'fact_checker']
const HISTORY_KEY = 'research_workspace_history'

function storedTheme() {
  try {
    return localStorage.getItem('theme') || 'light'
  } catch {
    return 'light'
  }
}

function initialStatuses() {
  return {
    researcher: 'waiting',
    summarizer: 'waiting',
    writer: 'waiting',
    fact_checker: 'waiting',
  }
}

function initialOutputs() {
  return {
    researcher: null,
    summarizer: null,
    writer: null,
    fact_checker: null,
  }
}

function storedHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

export default function App() {
  const [theme, setTheme] = useState(storedTheme)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentAgent, setCurrentAgent] = useState('')
  const [agentStatuses, setAgentStatuses] = useState(initialStatuses)
  const [agentOutputs, setAgentOutputs] = useState(initialOutputs)
  const [finalReport, setFinalReport] = useState('')
  const [factCheckNotes, setFactCheckNotes] = useState([])
  const [metadata, setMetadata] = useState({})
  const [sources, setSources] = useState([])
  const [history, setHistory] = useState(storedHistory)
  const [error, setError] = useState(null)
  const latestFactCheckNotes = useRef([])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // Theme still works for the current session if storage is unavailable.
    }
  }, [theme])

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  function saveHistory(entry) {
    setHistory((current) => {
      const next = [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 12)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        // History remains visible for the current session if storage is unavailable.
      }
      return next
    })
  }

  function clearHistory() {
    setHistory([])
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch {
      // No-op.
    }
  }

  function openHistoryItem(item) {
    setQuery(item.query)
    setFinalReport(item.report)
    setFactCheckNotes(item.factCheckNotes || [])
    latestFactCheckNotes.current = item.factCheckNotes || []
    setMetadata(item.metadata || {})
    setSources(item.sources || [])
    setCurrentAgent('complete')
    setIsLoading(false)
    setError(null)
    setAgentStatuses({
      researcher: 'completed',
      summarizer: 'completed',
      writer: 'completed',
      fact_checker: 'completed',
    })
  }

  async function handleResearch(nextQuery, uploadedDocuments = []) {
    setQuery(nextQuery)
    setIsLoading(true)
    setCurrentAgent('researcher')
    setAgentStatuses({ ...initialStatuses(), researcher: 'running' })
    setAgentOutputs(initialOutputs())
    setFinalReport('')
    setFactCheckNotes([])
    latestFactCheckNotes.current = []
    setMetadata({})
    setSources([])
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/research/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: nextQuery, uploaded_documents: uploadedDocuments }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`Research request failed with status ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          let event
          try {
            event = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (event.status === 'error') {
            setError(event.data?.error || 'Research failed.')
            setAgentStatuses((previous) => ({
              ...previous,
              [event.current_agent]: 'error',
            }))
            setIsLoading(false)
            return
          }

          if (event.status === 'complete') {
            const completedReport = event.data?.final_report || ''
            const completedMetadata = event.data?.metadata || {}
            const completedSources = event.data?.sources || []
            setFinalReport(completedReport)
            setMetadata(completedMetadata)
            setSources(completedSources)
            saveHistory({
              id: `${Date.now()}`,
              query: nextQuery,
              report: completedReport,
              factCheckNotes: latestFactCheckNotes.current,
              metadata: completedMetadata,
              sources: completedSources,
              createdAt: new Date().toLocaleString(),
            })
            setAgentStatuses((previous) => {
              const completed = { ...previous }
              agents.forEach((agent) => {
                completed[agent] = completed[agent] === 'error' ? 'error' : 'completed'
              })
              return completed
            })
            setCurrentAgent('complete')
            setIsLoading(false)
            continue
          }

          const agent = event.current_agent
          const agentIndex = agents.indexOf(agent)
          setCurrentAgent(agent)
          setAgentOutputs((previous) => ({ ...previous, [agent]: event.data }))

          if (agent === 'fact_checker') {
            const notes = event.data?.fact_check_notes || []
            latestFactCheckNotes.current = notes
            setFactCheckNotes(notes)
          }

          setAgentStatuses((previous) => {
            const next = { ...previous }
            agents.forEach((agentName, index) => {
              if (index < agentIndex) next[agentName] = 'completed'
            })
            next[agent] = event.status === 'completed' ? 'completed' : 'running'
            const nextAgent = agents[agentIndex + 1]
            if (nextAgent && event.status === 'completed') {
              next[nextAgent] = 'running'
              setCurrentAgent(nextAgent)
            }
            return next
          })
        }
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to stream research progress.')
      setIsLoading(false)
    }
  }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
    <main className="min-h-screen bg-[#f6f7f4] text-zinc-950 transition-colors dark:bg-zinc-950 dark:text-zinc-50">
      <div className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950">
              <FileSearch size={22} />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-normal text-zinc-950 dark:text-white sm:text-3xl">Research Workspace</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Plan, analyze, verify, and export a polished report.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {isLoading ? <Activity size={16} className="animate-pulse text-blue-500" /> : <Sparkles size={16} className="text-amber-500" />}
              {isLoading ? 'Working' : 'Ready'}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <QueryInput onSubmit={handleResearch} isLoading={isLoading} />

        {error ? (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 shadow-sm dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</div>
        ) : null}

        {(isLoading || finalReport || currentAgent) && (
          <div className="mt-6 grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
            <div className="space-y-5">
              <AgentProgress currentAgent={currentAgent} agentStatuses={agentStatuses} agentOutputs={agentOutputs} />
              <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">History</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Recent reports saved locally.</p>
                  </div>
                  <button type="button" onClick={clearHistory} disabled={history.length === 0} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="Clear history">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  {history.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No completed reports yet.</p>
                  ) : (
                    history.map((item) => (
                      <button key={item.id} type="button" onClick={() => openHistoryItem(item)} className="block w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-700 dark:hover:bg-blue-950">
                        <span className="line-clamp-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{item.query}</span>
                        <span className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <Clock size={13} />
                          {item.createdAt}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </div>
            <ReportDisplay report={finalReport} factCheckNotes={factCheckNotes} metadata={metadata} sources={sources} />
          </div>
        )}

        {!isLoading && !finalReport && !currentAgent ? (
          <section className="mt-6 grid gap-4 rounded-lg border border-dashed border-zinc-300 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:grid-cols-3">
            {['Gather sources', 'Build the report', 'Verify claims'].map((item) => (
              <div key={item} className="rounded-lg bg-zinc-50 p-4 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {item}
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </main>
    </div>
  )
}
