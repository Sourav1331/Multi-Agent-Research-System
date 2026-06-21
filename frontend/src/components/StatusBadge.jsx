import { CheckCircle, Clock, Loader2, XCircle } from 'lucide-react'

const statusStyles = {
  waiting: {
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
    icon: Clock,
    label: 'waiting',
  },
  running: {
    className: 'bg-blue-100 text-blue-700 ring-blue-200 animate-pulse',
    icon: Loader2,
    label: 'running...',
    iconClassName: 'animate-spin',
  },
  completed: {
    className: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    icon: CheckCircle,
    label: 'done',
  },
  error: {
    className: 'bg-rose-100 text-rose-700 ring-rose-200',
    icon: XCircle,
    label: 'failed',
  },
}

export default function StatusBadge({ agent, status }) {
  const config = statusStyles[status] || statusStyles.waiting
  const Icon = config.icon

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold capitalize ring-1 ${config.className}`}
    >
      <Icon size={14} className={config.iconClassName || ''} />
      {agent} {config.label}
    </span>
  )
}
