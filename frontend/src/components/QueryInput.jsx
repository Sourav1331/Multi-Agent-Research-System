import { Search } from 'lucide-react'

export default function QueryInput({ value, onChange, onSubmit, isLoading }) {
  return (
    <form className="query-input" onSubmit={onSubmit}>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter a research question"
      />
      <button type="submit" disabled={isLoading || !value.trim()} aria-label="Start research">
        <Search size={18} />
        <span>{isLoading ? 'Researching' : 'Research'}</span>
      </button>
    </form>
  )
}
