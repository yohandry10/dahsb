'use client'

import { useEffect, useState } from 'react'
import { 
  MessageSquare, 
  AlertCircle, 
  TrendingUp,
  Lightbulb,
  Search,
  ArrowUpRight
} from 'lucide-react'

interface ChatbotRequest {
  id: string
  question: string
  answer: string
  intent: string
  confidence_score: number
  was_supported: boolean
  was_escalated: boolean
  feedback: string
  created_at: string
}

export default function ChatbotInsightsPage() {
  const [requests, setRequests] = useState<ChatbotRequest[]>([])
  const [insights, setInsights] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const org_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

  const fetchInsights = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/intake/chatbot-miss?org_id=${org_id}&limit=100`)
      const data = await response.json()
      setRequests(data.data || [])
      setInsights(data.insights)
    } catch (error) {
      console.error('Failed to fetch chatbot insights:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [])

  const filteredRequests = requests.filter(r => 
    r.question?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const topUnsupported = (requests || [])
    .filter(r => !r.was_supported)
    .reduce((acc: Record<string, number>, r) => {
      const key = r.question.substring(0, 50)
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

  const topUnsupportedArray = Object.entries(topUnsupported)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const topIntents = (requests || [])
    .filter(r => r.intent)
    .reduce((acc: Record<string, number>, r) => {
      acc[r.intent] = (acc[r.intent] || 0) + 1
      return acc
    }, {})

  const topIntentsArray = Object.entries(topIntents)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Insights del Chatbot</h1>
          </div>
        </div>
      </header>

      <main className="p-6">
        {insights && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold text-foreground">{insights.total}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">No Soportadas</p>
              <p className="text-2xl font-bold text-red-500">{insights.unsupported}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Escaladas</p>
              <p className="text-2xl font-bold text-yellow-500">{insights.escalated}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Tasa de Soporte</p>
              <p className="text-2xl font-bold text-green-500">
                {insights.total > 0 
                  ? Math.round(((insights.total - insights.unsupported) / insights.total) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-semibold text-foreground">Top Preguntas No Soportadas</h2>
            </div>
            <div className="space-y-3">
              {topUnsupportedArray.length === 0 ? (
                <p className="text-muted-foreground">No unsupported questions yet</p>
              ) : (
                topUnsupportedArray.map(([question, count], idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 text-sm">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{question}...</p>
                      <p className="text-xs text-muted-foreground mt-1">{count} occurrences</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <h2 className="text-lg font-semibold text-foreground">Top Intenciones</h2>
            </div>
            <div className="space-y-3">
              {topIntentsArray.length === 0 ? (
                <p className="text-muted-foreground">No intents detected yet</p>
              ) : (
                topIntentsArray.map(([intent, count], idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-foreground">{intent}</span>
                        <span className="text-sm text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(count / (topIntentsArray[0]?.[1] || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              <h2 className="text-lg font-semibold text-foreground">Funcionalidades Sugeridas</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {topUnsupportedArray.slice(0, 3).map(([question, count], idx) => (
                <div key={idx} className="p-4 rounded-lg border border-border bg-muted/30">
                  <p className="text-sm text-foreground mb-2 line-clamp-2">{question}...</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{count} menciones</span>
                    <button className="text-xs text-primary hover:underline">
                      Crear Feature Request
                    </button>
                  </div>
                </div>
              ))}
              {topUnsupportedArray.length === 0 && (
                <p className="text-muted-foreground col-span-3">Create feature requests based on unsupported questions</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Requests Recientes</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar preguntas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-md border border-border bg-background text-foreground"
              />
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-muted-foreground">Pregunta</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Intención</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Confianza</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Soportado</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Escalado</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Fecha</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No requests found
                    </td>
                  </tr>
                ) : (
                  filteredRequests.slice(0, 20).map((req) => (
                    <tr key={req.id} className="hover:bg-muted/50">
                      <td className="p-4 text-sm text-foreground max-w-xs truncate">
                        {req.question}
                      </td>
                      <td className="p-4">
                        {req.intent ? (
                          <span className="px-2 py-1 rounded text-xs bg-secondary text-secondary-foreground">
                            {req.intent}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4 text-foreground">
                        {req.confidence_score ? `${Math.round(req.confidence_score)}%` : '-'}
                      </td>
                      <td className="p-4">
                        {req.was_supported ? (
                          <span className="text-green-500">Sí</span>
                        ) : (
                          <span className="text-red-500">No</span>
                        )}
                      </td>
                      <td className="p-4">
                        {req.was_escalated ? (
                          <span className="text-yellow-500">Sí</span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(req.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
