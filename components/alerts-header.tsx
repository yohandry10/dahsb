'use client'

import { useAlertsStore } from '@/lib/store'
import { Bell, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

interface AlertsHeaderProps {
  org_id: string
}

export default function AlertsHeader({ org_id }: AlertsHeaderProps) {
  const alerts = useAlertsStore((state) => state.alerts)
  const setLoading = useAlertsStore((state) => state.setLoading)
  const setAlerts = useAlertsStore((state) => state.setAlerts)

  const openCount = alerts.filter((a) => a.status === 'open').length
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/alerts?org_id=${org_id}`)
      const data = await response.json()
      if (response.ok) {
        setAlerts(data.data || [])
      }
    } catch (error) {
      console.error('[v0] Refresh failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Centro de Alertas</h1>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Abiertas:</span>
              <span className="font-semibold text-foreground">{openCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Críticas:</span>
              <span className="font-semibold text-destructive">{criticalCount}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>
    </header>
  )
}
