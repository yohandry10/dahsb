'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AlertsList from '@/components/alerts-list'
import AlertsHeader from '@/components/alerts-header'
import AlertsFilters from '@/components/alerts-filters'
import AlertDetail from '@/components/alert-detail'
import { useAlertsStore } from '@/lib/store'

export default function AlertsPageContent() {
  const searchParams = useSearchParams()
  const org_id = searchParams.get('org_id') || 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
  const [detailOpen, setDetailOpen] = useState(false)

  const { alerts, loading, selectedAlert, filters, pagination } = useAlertsStore()
  const setAlerts = useAlertsStore((state) => state.setAlerts)
  const setLoading = useAlertsStore((state) => state.setLoading)
  const setError = useAlertsStore((state) => state.setError)

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          org_id,
          limit: pagination.limit.toString(),
          offset: pagination.offset.toString(),
        })

        if (filters.status) params.append('status', filters.status)
        if (filters.severity) params.append('severity', filters.severity)
        if (filters.source) params.append('source', filters.source)
        if (filters.search) params.append('search', filters.search)

        const response = await fetch(`/api/alerts?${params}`)
        const data = await response.json()

        if (response.ok) {
          setAlerts(data.data || [])
        } else {
          setError(data.error || 'Failed to fetch alerts')
        }
      } catch (error) {
        console.error('[v0] Failed to fetch alerts:', error)
        setError('Failed to fetch alerts')
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
  }, [org_id, filters, pagination, setAlerts, setLoading, setError])

  return (
    <main className="min-h-screen bg-background">
      <AlertsHeader org_id={org_id} />
      
      <div className="flex h-[calc(100vh-120px)]">
        <div className="w-64 border-r border-border bg-card p-4">
          <AlertsFilters org_id={org_id} />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <AlertsList
              alerts={alerts}
              loading={loading}
              org_id={org_id}
              onSelectAlert={() => setDetailOpen(true)}
            />
          </div>
        </div>

        {selectedAlert && detailOpen && (
          <div className="w-96 border-l border-border bg-card flex flex-col">
            <AlertDetail
              alert={selectedAlert}
              org_id={org_id}
              onClose={() => setDetailOpen(false)}
            />
          </div>
        )}
      </div>
    </main>
  )
}
