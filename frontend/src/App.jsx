import { useState } from 'react'
import axios from 'axios'

import AgentProgress from './components/AgentProgress'
import QueryInput from './components/QueryInput'
import ReportDisplay from './components/ReportDisplay'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export default function App() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await axios.post(`${API_BASE_URL}/api/research`, { query })
      setResult(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to run research.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="header">
          <h1>Multi-Agent Research System</h1>
          <p>Coordinate research, synthesis, writing, and verification agents from one interface.</p>
        </div>

        <QueryInput value={query} onChange={setQuery} onSubmit={handleSubmit} isLoading={isLoading} />
        {error ? <div className="error">{error}</div> : null}

        <div className="content-grid">
          <AgentProgress steps={result?.steps || []} />
          <ReportDisplay report={result?.report} />
        </div>
      </section>
    </main>
  )
}
