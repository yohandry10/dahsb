'use client'

import { useEffect, useState } from 'react'
import { 
  Headphones, 
  AlertCircle, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Filter,
  Search
} from 'lucide-react'

interface Ticket {
  id: string
  ticket_external_id: string
  customer_email: string
  customer_name: string
  subject: string
  description: string
  priority: string
  status: string
  channel: string
  assigned_to: string
  sla_deadline: string
  first_response_at: string
  resolved_at: string
  created_at: string
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const org_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

  const fetchTickets = async () => {
    setLoading(true)
    try {
      let url = `/api/intake/support?org_id=${org_id}`
      if (statusFilter) url += `&status=${statusFilter}`
      if (priorityFilter) url += `&priority=${priorityFilter}`
      
      const response = await fetch(url)
      const data = await response.json()
      setTickets(data.data || [])
      setStats(data.stats)
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [statusFilter, priorityFilter])

  const filteredTickets = tickets.filter(t => 
    t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.customer_email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      high: 'bg-red-500/10 text-red-500',
      medium: 'bg-yellow-500/10 text-yellow-500',
      low: 'bg-green-500/10 text-green-500'
    }
    return styles[priority] || styles.medium
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const isSLABreached = (ticket: Ticket) => {
    return ticket.status === 'open' && ticket.sla_deadline && new Date(ticket.sla_deadline) < new Date()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Headphones className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Centro de Soporte</h1>
          </div>
        </div>
      </header>

      <main className="p-6">
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Total Tickets</p>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Abiertos</p>
              <p className="text-2xl font-bold text-red-500">{stats.open}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Alta Prioridad</p>
              <p className="text-2xl font-bold text-yellow-500">{stats.high_priority}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">SLA Incumplido</p>
              <p className="text-2xl font-bold text-red-500">{stats.sla_breached}</p>
            </div>
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-border bg-background text-foreground"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-md border border-border bg-background text-foreground"
          >
            <option value="">Todos los Estados</option>
            <option value="open">Abierto</option>
            <option value="in_progress">En Progreso</option>
            <option value="resolved">Resuelto</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 rounded-md border border-border bg-background text-foreground"
          >
            <option value="">Todas las Prioridades</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-muted-foreground">Estado</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Asunto</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Prioridad</th>
                <th className="text-left p-4 font-medium text-muted-foreground">SLA</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Canal</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No tickets found
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-muted/50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        <span className="text-foreground capitalize">{ticket.status.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-foreground">{ticket.subject}</p>
                      {ticket.description && (
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {ticket.description}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="text-foreground">{ticket.customer_name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{ticket.customer_email}</p>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${getPriorityBadge(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="p-4">
                      {isSLABreached(ticket) ? (
                        <span className="flex items-center gap-1 text-red-500">
                          <AlertTriangle className="h-4 w-4" />
                          Breached
                        </span>
                      ) : ticket.sla_deadline ? (
                        <span className="text-muted-foreground">
                          {new Date(ticket.sla_deadline).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-muted-foreground capitalize">{ticket.channel}</span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleString()}
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
