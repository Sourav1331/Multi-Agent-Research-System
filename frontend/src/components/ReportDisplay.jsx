import ReactMarkdown from 'react-markdown'

export default function ReportDisplay({ report }) {
  return (
    <section className="panel report">
      <h2>Report</h2>
      {report ? <ReactMarkdown>{report}</ReactMarkdown> : <p className="muted">Research output will appear here.</p>}
    </section>
  )
}
