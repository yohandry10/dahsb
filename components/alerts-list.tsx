'use client'

import { Alert } from '@/lib/api-client'
import { useAlertsStore } from '@/lib/store'
import { AlertCircle, CheckCircle, Clock, AlertTriangle, Inbox } from 'lucide-react'
import { format } from 'date-fns'

interface AlertsListProps {
  alerts: Alert[]
  loading: boolean
  org_id: string
  onSelectAlert: () => void
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'text-red-500 bg-red-500/10'
    case 'high':
      return 'text-orange-500 bg-orange-500/10'
    case 'medium':
      return 'text-yellow-500 bg-yellow-500/10'
    case 'low':
      return 'text-blue-500 bg-blue-500/10'
    default:
      return 'text-muted-foreground bg-muted'
  }
}

const getSeverityLabel = (severity: string) => {
  switch (severity) {
    case 'critical': return 'Crítico'
    case 'high': return 'Alto'
    case 'medium': return 'Medio'
    case 'low': return 'Bajo'
    case 'info': return 'Información'
    default: return severity
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'open': return 'Abierto'
    case 'acknowledged': return 'Reconocido'
    case 'resolved': return 'Resuelto'
    case 'snoozed': return 'Pospuesto'
    default: return status
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'open':
      return <AlertCircle className="h-5 w-5" />
    case 'acknowledged':
      return <Clock className="h-5 w-5" />
    case 'resolved':
      return <CheckCircle className="h-5 w-5" />
    case 'snoozed':
      return <AlertTriangle className="h-5 w-5" />
    default:
      return <AlertCircle className="h-5 w-5" />
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open':
      return 'text-red-500'
    case 'acknowledged':
      return 'text-yellow-500'
    case 'resolved':
      return 'text-green-500'
    case 'snoozed':
      return 'text-blue-500'
    default:
      return 'text-muted-foreground'
  }
}

export default function AlertsList({
  alerts,
  loading,
  org_id,
  onSelectAlert,
}: AlertsListProps) {
  const setSelectedAlert = useAlertsStore((state) => state.setSelectedAlert)

  const handleSelectAlert = (alert: Alert) => {
    setSelectedAlert(alert)
    onSelectAlert()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Cargando alertas...</div>
      </div>
    )
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Inbox className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-foreground">No se encontraron alertas</p>
        <p className="mt-1 text-sm text-muted-foreground">
          ¡Todo tranquilo! Las alertas aparecerán aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          onClick={() => handleSelectAlert(alert)}
          className="border-l-4 border-l-border bg-card p-4 transition-all hover:border-l-primary hover:bg-accent cursor-pointer"
        >
          <div className="flex items-start gap-4">
            <div className={`mt-1 ${getStatusColor(alert.status)}`}>
              {getStatusIcon(alert.status)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground truncate">
                    {alert.title}
                  </h3>
                  {alert.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {alert.description}
                    </p>
                  )}
                </div>

                <div
                  className={`flex-shrink-0 rounded px-2 py-1 text-xs font-medium ${getSeverityColor(
                    alert.severity
                  )}`}
                >
                  {getSeverityLabel(alert.severity)}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-block bg-secondary px-2 py-1 rounded text-secondary-foreground">
                  {alert.source}
                </span>
                <span>{format(new Date(alert.created_at), 'MMM d, h:mm a')}</span>
                <span className="text-muted-foreground">Estado: {getStatusLabel(alert.status)}</span>
              </div>

              {alert.tags && alert.tags.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {alert.tags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-block text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
