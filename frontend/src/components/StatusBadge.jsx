import { CheckCircle, Clock, Loader2, XCircle } from 'lucide-react'

const statusStyles = {
  waiting: {
    className: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
    icon: Clock,
    label: 'waiting',
  },
  running: {
    className: 'bg-blue-100 text-blue-700 ring-blue-200 animate-pulse dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800',
    icon: Loader2,
    label: 'running...',
    iconClassName: 'animate-spin',
  },
  completed: {
    className: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800',
    icon: CheckCircle,
    label: 'done',
  },
  error: {
    className: 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-800',
    icon: XCircle,
    label: 'failed',
  },
}

export default function StatusBadge({ agent, status }) {
  const config = statusStyles[status] || statusStyles.waiting
  const Icon = config.icon

  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold capitalize ring-1 ${config.className}`}
    >
      <Icon size={14} className={config.iconClassName || ''} />
      {agent} {config.label}
    </span>
  )
}
