import StatusBadge from './StatusBadge'

export default function AgentProgress({ steps = [] }) {
  return (
    <section className="panel">
      <h2>Agent Progress</h2>
      <div className="agent-list">
        {steps.length === 0 ? (
          <p className="muted">No agent activity yet.</p>
        ) : (
          steps.map((step) => (
            <div className="agent-row" key={step.agent}>
              <span>{step.agent.replace('_', ' ')}</span>
              <StatusBadge status="complete" />
            </div>
          ))
        )}
      </div>
    </section>
  )
}
