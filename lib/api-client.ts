import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface Alert {
  id: string
  org_id: string
  source: string
  title: string
  description: string | null
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  status: 'open' | 'acknowledged' | 'resolved' | 'snoozed'
  tags: string[]
  metadata: Record<string, any>
  snoozed_until: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  acknowledged_by: string | null
  acknowledged_at: string | null
  resolved_by: string | null
  resolved_at: string | null
}

export interface Organization {
  id: string
  name: string
  slug: string
  webhook_secret: string
  rate_limit_per_minute: number
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  org_id: string
  alert_id: string | null
  action: string
  actor: string
  old_state: Record<string, any> | null
  new_state: Record<string, any> | null
  reason: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export async function createAlert(alert: Partial<Alert>) {
  const { data, error } = await supabase
    .from('alerts')
    .insert(alert)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getAlerts(
  org_id: string,
  options?: {
    status?: string
    severity?: string
    source?: string
    search?: string
    limit?: number
    offset?: number
  }
) {
  let query = supabase
    .from('alerts')
    .select('*')
    .eq('org_id', org_id)

  if (options?.status) {
    query = query.eq('status', options.status)
  }
  if (options?.severity) {
    query = query.eq('severity', options.severity)
  }
  if (options?.source) {
    query = query.eq('source', options.source)
  }

  if (options?.search) {
    query = query.or(
      `title.ilike.%${options.search}%,description.ilike.%${options.search}%`
    )
  }

  query = query.order('created_at', { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit)
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}

export async function getAlert(id: string) {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function updateAlertStatus(
  alert_id: string,
  status: string,
  actor: string,
  reason?: string
) {
  const alert = await getAlert(alert_id)
  const oldState = { status: alert.status }

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'acknowledged') {
    updateData.acknowledged_by = actor
    updateData.acknowledged_at = new Date().toISOString()
  } else if (status === 'resolved') {
    updateData.resolved_by = actor
    updateData.resolved_at = new Date().toISOString()
  }

  const { data: updatedAlert, error } = await supabase
    .from('alerts')
    .update(updateData)
    .eq('id', alert_id)
    .select()
    .single()

  if (error) throw error

  // Log audit trail
  await createAuditLog({
    org_id: alert.org_id,
    alert_id,
    action: `alert_${status}`,
    actor,
    old_state: oldState,
    new_state: { status },
    reason: reason || null,
  })

  return updatedAlert
}

export async function snoozeAlert(
  alert_id: string,
  until: Date,
  actor: string
) {
  const alert = await getAlert(alert_id)

  const { data: updatedAlert, error } = await supabase
    .from('alerts')
    .update({
      snoozed_until: until.toISOString(),
      status: 'snoozed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', alert_id)
    .select()
    .single()

  if (error) throw error

  // Log audit trail
  await createAuditLog({
    org_id: alert.org_id,
    alert_id,
    action: 'alert_snoozed',
    actor,
    old_state: { status: alert.status, snoozed_until: alert.snoozed_until },
    new_state: { status: 'snoozed', snoozed_until: until.toISOString() },
  })

  return updatedAlert
}

export async function createAuditLog(log: Partial<AuditLog>) {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert(log)
    .select()
    .single()

  if (error) {
    console.error('[v0] Failed to create audit log:', error)
    // Don't throw - audit logging should be best effort
  }

  return data
}

export async function getAuditLogs(
  org_id: string,
  alert_id?: string,
  options?: {
    limit?: number
    offset?: number
  }
) {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('org_id', org_id)

  if (alert_id) {
    query = query.eq('alert_id', alert_id)
  }

  query = query.order('created_at', { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit)
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}

export async function getOrganization(org_id: string) {
  const { data, error } = await supabase
    .from('orgs')
    .select('*')
    .eq('id', org_id)
    .single()

  if (error) throw error
  return data
}

export async function getAlertStats(org_id: string) {
  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('status, severity')
    .eq('org_id', org_id)

  if (error) throw error

  const stats = {
    total: alerts?.length || 0,
    open: 0,
    acknowledged: 0,
    resolved: 0,
    snoozed: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  }

  alerts?.forEach((alert) => {
    stats[alert.status as keyof typeof stats]++
    stats[alert.severity as keyof typeof stats]++
  })

  return stats
}
