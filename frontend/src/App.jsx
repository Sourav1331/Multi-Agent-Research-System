import { useState } from 'react'

import AgentProgress from './components/AgentProgress'
import QueryInput from './components/QueryInput'
import ReportDisplay from './components/ReportDisplay'

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const agents = ['researcher', 'summarizer', 'writer', 'fact_checker']

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

export default function App() {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentAgent, setCurrentAgent] = useState('')
  const [agentStatuses, setAgentStatuses] = useState(initialStatuses)
  const [agentOutputs, setAgentOutputs] = useState(initialOutputs)
  const [finalReport, setFinalReport] = useState('')
  const [factCheckNotes, setFactCheckNotes] = useState([])
  const [metadata, setMetadata] = useState({})
  const [error, setError] = useState(null)

  async function handleResearch(nextQuery) {
    setQuery(nextQuery)
    setIsLoading(true)
    setCurrentAgent('researcher')
    setAgentStatuses({ ...initialStatuses(), researcher: 'running' })
    setAgentOutputs(initialOutputs())
    setFinalReport('')
    setFactCheckNotes([])
    setMetadata({})
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/research/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: nextQuery }),
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
            setFinalReport(event.data?.final_report || '')
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
            setFactCheckNotes(event.data?.fact_check_notes || [])
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
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl">Multi-Agent Research System</h1>
          <p className="mt-2 text-slate-600">Powered by LangGraph + Groq LLaMA 3.1</p>
        </header>

        <QueryInput onSubmit={handleResearch} isLoading={isLoading} />

        {error ? (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
        ) : null}

        {(isLoading || finalReport || currentAgent) && (
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(320px,40%)_minmax(0,60%)]">
            <AgentProgress currentAgent={currentAgent} agentStatuses={agentStatuses} agentOutputs={agentOutputs} />
            <ReportDisplay report={finalReport} factCheckNotes={factCheckNotes} metadata={metadata} />
          </div>
        )}

        {!isLoading && !finalReport && !currentAgent ? (
          <section className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            Enter a research question to start the agent pipeline.
          </section>
        ) : null}
      </div>
    </main>
  )
}
