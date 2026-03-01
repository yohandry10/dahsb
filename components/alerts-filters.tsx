'use client'

import { useAlertsStore } from '@/lib/store'
import { X } from 'lucide-react'

interface AlertsFiltersProps {
  org_id: string
}

const SEVERITIES = [
  { value: 'critical', label: 'Crítico' },
  { value: 'high', label: 'Alto' },
  { value: 'medium', label: 'Medio' },
  { value: 'low', label: 'Bajo' },
  { value: 'info', label: 'Información' }
]

const STATUSES = [
  { value: 'open', label: 'Abierto' },
  { value: 'acknowledged', label: 'Reconocido' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'snoozed', label: 'Pospuesto' }
]

export default function AlertsFilters({ org_id }: AlertsFiltersProps) {
  const filters = useAlertsStore((state) => state.filters)
  const setFilters = useAlertsStore((state) => state.setFilters)

  const handleSeverityToggle = (severity: string) => {
    setFilters({
      severity: filters.severity === severity ? undefined : severity,
    })
  }

  const handleStatusToggle = (status: string) => {
    setFilters({
      status: filters.status === status ? undefined : status,
    })
  }

  const handleClearFilters = () => {
    setFilters({
      status: undefined,
      severity: undefined,
      source: undefined,
      search: undefined,
    })
  }

  const hasFilters =
    filters.status || filters.severity || filters.source || filters.search

  const getSeverityLabel = (value: string) => SEVERITIES.find(s => s.value === value)?.label || value
  const getStatusLabel = (value: string) => STATUSES.find(s => s.value === value)?.label || value

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Filtros</h2>
        {hasFilters && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar
          </button>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Severidad</h3>
        <div className="space-y-2">
          {SEVERITIES.map((severity) => (
            <button
              key={severity.value}
              onClick={() => handleSeverityToggle(severity.value)}
              className={`block w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                filters.severity === severity.value
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {severity.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Estado</h3>
        <div className="space-y-2">
          {STATUSES.map((status) => (
            <button
              key={status.value}
              onClick={() => handleStatusToggle(status.value)}
              className={`block w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                filters.status === status.value
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {hasFilters && (
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Filtros activos
          </p>
          <div className="space-y-2">
            {filters.status && (
              <div className="flex items-center justify-between rounded bg-secondary px-2 py-1">
                <span className="text-xs text-foreground">
                  Estado: {getStatusLabel(filters.status)}
                </span>
                <button
                  onClick={() => setFilters({ status: undefined })}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.severity && (
              <div className="flex items-center justify-between rounded bg-secondary px-2 py-1">
                <span className="text-xs text-foreground">
                  Severidad: {getSeverityLabel(filters.severity)}
                </span>
                <button
                  onClick={() => setFilters({ severity: undefined })}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
