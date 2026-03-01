'use client'

import { Alert, AuditLog } from '@/lib/api-client'
import { useAlertsStore } from '@/lib/store'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Check, Clock, RotateCcw, Volume2 } from 'lucide-react'
import { format } from 'date-fns'

interface AlertDetailProps {
  alert: Alert
  org_id: string
  onClose: () => void
}

export default function AlertDetail({
  alert,
  org_id,
  onClose,
}: AlertDetailProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const updateAlert = useAlertsStore((state) => state.updateAlert)

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const response = await fetch(
          `/api/audit-logs?org_id=${org_id}&alert_id=${alert.id}&limit=20`
        )
        const data = await response.json()
        if (response.ok) {
          setAuditLogs(data.data || [])
        }
      } catch (error) {
        console.error('[v0] Failed to fetch audit logs:', error)
      }
    }

    fetchAuditLogs()
  }, [alert.id, org_id])

  const handleAction = async (
    action: 'acknowledge' | 'resolve' | 'reopen' | 'snooze',
    extraData?: Record<string, any>
  ) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/alerts/${alert.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          actor: 'founder@gitgov.dev',
          reason: 'Manual action from alerts center',
          ...extraData,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        updateAlert(data.data)
        console.log('[v0] Alert action completed:', { action, alertId: alert.id })
      }
    } catch (error) {
      console.error('[v0] Failed to perform action:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSnooze = () => {
    const snoozeUntil = new Date(Date.now() + 1 * 60 * 60 * 1000)
    handleAction('snooze', { until: snoozeUntil.toISOString() })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b border-border px-4 py-4 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Detalles de Alerta</h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Título</p>
              <p className="mt-1 text-sm text-foreground font-semibold">
                {alert.title}
              </p>
            </div>

            {alert.description && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Descripción</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {alert.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Severidad</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {alert.severity === 'critical' ? 'Crítico' : 
                   alert.severity === 'high' ? 'Alto' :
                   alert.severity === 'medium' ? 'Medio' :
                   alert.severity === 'low' ? 'Bajo' :
                   alert.severity === 'info' ? 'Información' : alert.severity}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Estado</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {alert.status === 'open' ? 'Abierto' :
                   alert.status === 'acknowledged' ? 'Reconocido' :
                   alert.status === 'resolved' ? 'Resuelto' :
                   alert.status === 'snoozed' ? 'Pospuesto' : alert.status}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Origen</p>
                <p className="mt-1 text-sm text-foreground">{alert.source}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Creado</p>
                <p className="mt-1 text-sm text-foreground">
                  {format(new Date(alert.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Acciones</p>
            <div className="space-y-2">
              {alert.status === 'open' && (
                <>
                  <Button
                    onClick={() => handleAction('acknowledge')}
                    disabled={loading}
                    className="w-full justify-start gap-2"
                    size="sm"
                  >
                    <Clock className="h-4 w-4" />
                    Reconocer
                  </Button>
                  <Button
                    onClick={() => handleAction('resolve')}
                    disabled={loading}
                    className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <Check className="h-4 w-4" />
                    Resolver
                  </Button>
                  <Button
                    onClick={handleSnooze}
                    disabled={loading}
                    className="w-full justify-start gap-2"
                    variant="secondary"
                    size="sm"
                  >
                    <Volume2 className="h-4 w-4" />
                    Posponer 1h
                  </Button>
                </>
              )}

              {alert.status === 'acknowledged' && (
                <>
                  <Button
                    onClick={() => handleAction('resolve')}
                    disabled={loading}
                    className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <Check className="h-4 w-4" />
                    Resolver
                  </Button>
                  <Button
                    onClick={() => handleAction('reopen')}
                    disabled={loading}
                    className="w-full justify-start gap-2"
                    variant="secondary"
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reabrir
                  </Button>
                </>
              )}

              {(alert.status === 'resolved' ||
                alert.status === 'snoozed') && (
                <Button
                  onClick={() => handleAction('reopen')}
                  disabled={loading}
                  className="w-full justify-start gap-2"
                  variant="secondary"
                  size="sm"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reabrir
                </Button>
              )}
            </div>
          </div>

          {auditLogs.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                Registro de Actividad
              </p>
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="text-xs">
                    <p className="text-foreground">
                      <span className="font-semibold">{log.actor}</span>{' '}
                      <span className="text-muted-foreground">{log.action}</span>
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {format(new Date(log.created_at), 'MMM d, h:mm a')}
                    </p>
                    {log.reason && (
                      <p className="mt-1 text-muted-foreground italic">
                        Reason: {log.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
