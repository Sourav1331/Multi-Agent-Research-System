import { FileText, PenLine, Search, ShieldCheck } from 'lucide-react'

import StatusBadge from './StatusBadge'

const agents = [
  { id: 'researcher', name: 'Researcher', icon: Search },
  { id: 'summarizer', name: 'Summarizer', icon: FileText },
  { id: 'writer', name: 'Writer', icon: PenLine },
  { id: 'fact_checker', name: 'Fact Checker', icon: ShieldCheck },
]

function outputSummary(agentId, output) {
  if (!output) return null

  if (agentId === 'researcher') {
    return <p className="text-sm text-slate-600">Found {output.sources_found || 0} sources</p>
  }

  if (agentId === 'summarizer') {
    return <p className="text-sm text-slate-600">Extracted {output.summaries_count || 0} key points</p>
  }

  if (agentId === 'writer') {
    return <p className="text-sm text-slate-600">Draft report ready ({output.draft_length || 0} characters)</p>
  }

  if (agentId === 'fact_checker') {
    const notes = output.fact_check_notes || []
    return (
      <div className="flex flex-wrap gap-2">
        {notes.length === 0 ? (
          <p className="text-sm text-slate-600">No fact checks yet</p>
        ) : (
          notes.map((note, index) => (
            <span
              key={`${note.claim}-${index}`}
              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                note.verified ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {note.verified ? 'Verified' : 'Unverified'} {Math.round((note.confidence || 0) * 100)}%
            </span>
          ))
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
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700">
          <span>Agent Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
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
              className={`rounded-lg border bg-white p-4 transition ${
                isRunning ? 'running-agent-card border-blue-200 shadow-sm' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-950">{agent.name}</h3>
                    <div className="mt-2">{status === 'completed' ? outputSummary(agent.id, agentOutputs[agent.id]) : null}</div>
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
