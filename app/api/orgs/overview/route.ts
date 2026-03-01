import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    const searchParams = request.nextUrl.searchParams
    const org_id = searchParams.get('org_id')

    if (!org_id) {
      const { data: allOrgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false })

      if (orgsError) throw orgsError

      const overview = await Promise.all((allOrgs || []).map(async (org) => {
        const [alerts, tickets, metrics] = await Promise.all([
          supabase.from('alerts').select('status', { count: 'exact' }).eq('organization_id', org.id),
          supabase.from('support_tickets').select('status', { count: 'exact' }).eq('organization_id', org.id),
          supabase.from('metrics').select('*').eq('organization_id', org.id).gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        ])

        const openAlerts = alerts.data?.filter(a => a.status === 'open').length || 0
        const criticalAlerts = alerts.data?.filter(a => a.severity === 'critical' && a.status === 'open').length || 0
        const openTickets = tickets.data?.filter(t => t.status === 'open').length || 0
        const highPriorityTickets = tickets.data?.filter(t => t.priority === 'high' && t.status === 'open').length || 0

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          health_status: openAlerts > 10 || criticalAlerts > 0 ? 'warning' : 'healthy',
          open_alerts: openAlerts,
          critical_alerts: criticalAlerts,
          open_tickets: openTickets,
          high_priority_tickets: highPriorityTickets,
          last_activity: org.last_activity_at,
          created_at: org.created_at
        }
      }))

      return NextResponse.json({
        data: overview,
        total: overview.length,
        request_id: requestId
      })
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', org_id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const [alertsResult, ticketsResult, customersResult, integrationsResult, metricsResult] = await Promise.all([
      supabase.from('alerts').select('status, severity').eq('organization_id', org_id),
      supabase.from('support_tickets').select('status, priority, sla_deadline').eq('organization_id', org_id),
      supabase.from('customers').select('health_score, mrr, plan').eq('organization_id', org_id),
      supabase.from('integrations_health').select('*').eq('organization_id', org_id),
      supabase.from('metrics').select('*').eq('organization_id', org_id).gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    ])

    const alerts = alertsResult.data || []
    const tickets = ticketsResult.data || []
    const customers = customersResult.data || []
    const integrations = integrationsResult.data || []
    const metrics = metricsResult.data || []

    const overview = {
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        created_at: org.created_at
      },
      alerts: {
        total: alerts.length,
        open: alerts.filter(a => a.status === 'open').length,
        critical: alerts.filter(a => a.severity === 'critical' && a.status === 'open').length,
        acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
        resolved: alerts.filter(a => a.status === 'resolved').length
      },
      support: {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        high_priority: tickets.filter(t => t.priority === 'high' && t.status === 'open').length,
        sla_breached: tickets.filter(t => t.status === 'open' && new Date(t.sla_deadline) < new Date()).length
      },
      customers: {
        total: customers.length,
        avg_health_score: customers.length > 0 
          ? Math.round(customers.reduce((sum, c) => sum + (c.health_score || 0), 0) / customers.length) 
          : 0,
        total_mrr: customers.reduce((sum, c) => sum + (c.mrr || 0), 0)
      },
      integrations: {
        total: integrations.length,
        healthy: integrations.filter(i => i.status === 'healthy').length,
        degraded: integrations.filter(i => i.status === 'degraded').length,
        down: integrations.filter(i => i.status === 'down').length
      },
      metrics_24h: {
        total_events: metrics.length,
        by_type: metrics.reduce((acc: any, m) => {
          acc[m.metric_name] = (acc[m.metric_name] || 0) + 1
          return acc
        }, {})
      }
    }

    await supabase.from('organizations').update({
      last_activity_at: new Date().toISOString()
    }).eq('id', org_id)

    return NextResponse.json({
      data: overview,
      request_id: requestId
    })

  } catch (error: any) {
    console.error(`[${requestId}] Error in /api/orgs/overview:`, error)
    return NextResponse.json({
      error: 'Internal server error',
      request_id: requestId
    }, { status: 500 })
  }
}
