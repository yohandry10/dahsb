'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Clock,
  Activity,
  ExternalLink
} from 'lucide-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

interface Integration {
  id: string
  integration_name: string
  endpoint_url: string
  status: string
  last_check_at: string
  last_success_at: string
  last_error_message: string
  error_count_24h: number
  avg_latency_ms: number
  uptime_percentage: number
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const org_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

  const fetchIntegrations = async () => {
    try {
      const response = await fetch(`/api/integrations?org_id=${org_id}`)
      const data = await response.json()
      setIntegrations(data.data || [])
    } catch (error) {
      console.error('Failed to fetch integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIntegrations()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchIntegrations()
    setRefreshing(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'down':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      healthy: 'bg-green-500/10 text-green-500 border-green-500/20',
      degraded: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      down: 'bg-red-500/10 text-red-500 border-red-500/20',
      unknown: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    }
    return styles[status as keyof typeof styles] || styles.unknown
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Integraciones</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </header>

      <main className="p-6">
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Total Integrations</p>
            <p className="text-2xl font-bold text-foreground">{integrations.length}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Healthy</p>
            <p className="text-2xl font-bold text-green-500">
              {integrations.filter(i => i.status === 'healthy').length}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Issues</p>
            <p className="text-2xl font-bold text-red-500">
              {integrations.filter(i => i.status === 'down').length}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Integration</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Endpoint</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Uptime (24h)</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Latency</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Errors (24h)</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Last Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {integrations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No integrations configured. Add integrations via API.
                  </td>
                </tr>
              ) : (
                integrations.map((integration) => (
                  <tr key={integration.id} className="hover:bg-muted/50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(integration.status)}
                        <span className={`px-2 py-1 rounded-full text-xs border ${getStatusBadge(integration.status)}`}>
                          {integration.status}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-foreground">{integration.integration_name}</td>
                    <td className="p-4">
                      <a 
                        href={integration.endpoint_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        {integration.endpoint_url?.substring(0, 40)}...
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="p-4 text-foreground">
                      <span className={integration.uptime_percentage >= 99 ? 'text-green-500' : integration.uptime_percentage >= 95 ? 'text-yellow-500' : 'text-red-500'}>
                        {integration.uptime_percentage?.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-4 text-foreground">{integration.avg_latency_ms}ms</td>
                    <td className="p-4">
                      <span className={integration.error_count_24h > 0 ? 'text-red-500' : 'text-muted-foreground'}>
                        {integration.error_count_24h}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {integration.last_check_at 
                        ? new Date(integration.last_check_at).toLocaleString()
                        : 'Never'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
