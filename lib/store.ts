import { create } from 'zustand'
import { Alert, AuditLog } from './api-client'

interface AlertsStore {
  // State
  alerts: Alert[]
  selectedAlert: Alert | null
  auditLogs: AuditLog[]
  loading: boolean
  error: string | null
  filters: {
    status?: string
    severity?: string
    source?: string
    search?: string
  }
  pagination: {
    limit: number
    offset: number
    hasMore: boolean
  }

  // Actions
  setAlerts: (alerts: Alert[]) => void
  addAlert: (alert: Alert) => void
  updateAlert: (alert: Alert) => void
  deleteAlert: (id: string) => void
  setSelectedAlert: (alert: Alert | null) => void
  setAuditLogs: (logs: AuditLog[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setFilters: (filters: Partial<AlertsStore['filters']>) => void
  setPagination: (
    pagination: Partial<AlertsStore['pagination']>
  ) => void
  reset: () => void
}

const initialState = {
  alerts: [],
  selectedAlert: null,
  auditLogs: [],
  loading: false,
  error: null,
  filters: {},
  pagination: {
    limit: 50,
    offset: 0,
    hasMore: true,
  },
}

export const useAlertsStore = create<AlertsStore>((set, get) => ({
  ...initialState,

  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts],
    })),

  updateAlert: (alert) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === alert.id ? alert : a)),
      selectedAlert:
        state.selectedAlert?.id === alert.id ? alert : state.selectedAlert,
    })),

  deleteAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
      selectedAlert:
        state.selectedAlert?.id === id ? null : state.selectedAlert,
    })),

  setSelectedAlert: (alert) => set({ selectedAlert: alert }),
  setAuditLogs: (logs) => set({ auditLogs: logs }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, offset: 0 },
    })),

  setPagination: (pagination) =>
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    })),

  reset: () => set(initialState),
}))
