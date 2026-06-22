import { FileText, PenLine, Search, ShieldCheck } from 'lucide-react'

import StatusBadge from './StatusBadge'

const agents = [
  { id: 'researcher', name: 'Researcher', icon: Search, role: 'Collects web and document evidence' },
  { id: 'summarizer', name: 'Summarizer', icon: FileText, role: 'Compresses sources into key findings' },
  { id: 'writer', name: 'Writer', icon: PenLine, role: 'Drafts the structured report' },
  { id: 'fact_checker', name: 'Fact Checker', icon: ShieldCheck, role: 'Validates claims against sources' },
]

function outputSummary(agentId, output) {
  if (!output) return null

  if (agentId === 'researcher') {
    const sourceLabel = output.web_search_used ? 'web + documents' : 'documents only'
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Found {output.sources_found || 0} sources from {sourceLabel}</p>
  }

  if (agentId === 'summarizer') {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Extracted {output.summaries_count || 0} key points</p>
  }

  if (agentId === 'writer') {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Draft report ready ({output.draft_length || 0} characters)</p>
  }

  if (agentId === 'fact_checker') {
    const notes = output.fact_check_notes || []
    const verifiedCount = notes.filter((note) => note.verified).length
    return (
      <div className="flex flex-wrap gap-2">
        {notes.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No fact checks yet</p>
        ) : (
          <>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
              {verifiedCount}/{notes.length} verified
            </span>
          </>
        )}
      </div>
    )
  }

  return null
}

export default function AgentProgress({ currentAgent, agentStatuses, agentOutputs }) {
  const completedCount = agents.filter((agent) => agentStatuses[agent.id] === 'completed').length
  const progress = Math.round((completedCount / agents.length) * 100)

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <span>Agent Timeline</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-blue-600 transition-all duration-500 dark:bg-blue-400" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {agents.map((agent) => {
          const Icon = agent.icon
          const status = agentStatuses[agent.id] || 'waiting'
          const isRunning = currentAgent === agent.id && status === 'running'

          return (
            <article
              key={agent.id}
              className={`rounded-lg border bg-white p-4 transition dark:bg-zinc-950 ${
                isRunning ? 'running-agent-card border-blue-200 shadow-sm dark:border-blue-700' : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : isRunning
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">{agent.name}</h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{agent.role}</p>
                    <div className="mt-2 min-h-5">
                      {status === 'completed' ? outputSummary(agent.id, agentOutputs[agent.id]) : null}
                      {isRunning ? <p className="text-sm font-medium text-blue-600 dark:text-blue-300">Processing now</p> : null}
                    </div>
                  </div>
                </div>
                <StatusBadge agent={agent.name} status={status} />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
