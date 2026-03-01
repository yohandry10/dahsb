'use client'

import { useEffect, useState } from 'react'
import { 
  Users, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Search,
  Filter
} from 'lucide-react'

interface Customer {
  id: string
  external_customer_id: string
  email: string
  name: string
  plan: string
  mrr: number
  health_score: number
  health_status: string
  open_alerts: number
  open_tickets: number
  last_contact: string
  created_at: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [healthFilter, setHealthFilter] = useState<string>('')

  const org_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      let url = `/api/customers/overview?org_id=${org_id}`
      if (healthFilter) url += `&health=${healthFilter}`
      
      const response = await fetch(url)
      const data = await response.json()
      setCustomers(data.data || [])
      setStats(data.stats)
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [healthFilter])

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 50) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getHealthBadge = (status: string) => {
    const styles: Record<string, string> = {
      healthy: 'bg-green-500/10 text-green-500',
      warning: 'bg-yellow-500/10 text-yellow-500',
      critical: 'bg-red-500/10 text-red-500'
    }
    return styles[status] || styles.warning
  }

  const getHealthLabel = (status: string) => {
    switch (status) {
      case 'healthy': return 'Saludable'
      case 'warning': return 'Advertencia'
      case 'critical': return 'Crítico'
      default: return status
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          </div>
        </div>
      </header>

      <main className="p-6">
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Total Clientes</p>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Saludables</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-green-500">{stats.healthy}</p>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">En Riesgo</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Puntuación Promedio</p>
              <p className="text-2xl font-bold text-foreground">{stats.avg_health_score}</p>
            </div>
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-border bg-background text-foreground"
            />
          </div>
          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="px-4 py-2 rounded-md border border-border bg-background text-foreground"
          >
            <option value="">Toda la Salud</option>
            <option value="healthy">Saludable (80+)</option>
            <option value="warning">Advertencia (50-79)</option>
            <option value="critical">Crítico (&lt;50)</option>
          </select>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Plan</th>
                <th className="text-left p-4 font-medium text-muted-foreground">MRR</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Salud</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Alertas Abiertas</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Tickets Abiertos</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Último Contacto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No customers found
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-muted/50">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-foreground">{customer.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{customer.email}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
                        {customer.plan}
                      </span>
                    </td>
                    <td className="p-4 text-foreground">${customer.mrr}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${getHealthColor(customer.health_score)}`}>
                          {customer.health_score}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getHealthBadge(customer.health_status)}`}>
                          {getHealthLabel(customer.health_status)}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      {customer.open_alerts > 0 ? (
                        <span className="flex items-center gap-1 text-red-500">
                          <AlertCircle className="h-4 w-4" />
                          {customer.open_alerts}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="p-4 text-foreground">{customer.open_tickets}</td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {customer.last_contact 
                        ? new Date(customer.last_contact).toLocaleDateString()
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
