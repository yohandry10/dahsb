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
    const health_filter = searchParams.get('health')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!org_id) {
      return NextResponse.json(
        { error: 'Missing org_id parameter', request_id: requestId },
        { status: 400 }
      )
    }

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('organization_id', org_id)
      .order('health_score', { ascending: true })
      .range(offset, offset + limit - 1)

    if (health_filter === 'critical') {
      query = query.lt('health_score', 50)
    } else if (health_filter === 'warning') {
      query = query.gte('health_score', 50).lt('health_score', 80)
    } else if (health_filter === 'healthy') {
      query = query.gte('health_score', 80)
    }

    const { data: customers, count, error } = await query

    if (error) {
      console.error(`[${requestId}] Failed to fetch customers:`, error)
      return NextResponse.json({
        error: 'Failed to fetch customers',
        request_id: requestId
      }, { status: 500 })
    }

    const [alertsResult, ticketsResult] = await Promise.all([
      supabase.from('alerts').select('organization_id, status').eq('organization_id', org_id),
      supabase.from('support_tickets').select('organization_id, status').eq('organization_id', org_id)
    ])

    const openAlerts = alertsResult.data?.filter(a => a.status === 'open').length || 0
    const openTickets = ticketsResult.data?.filter(t => t.status === 'open').length || 0

    const enrichedCustomers = (customers || []).map(customer => ({
      id: customer.id,
      external_customer_id: customer.external_customer_id,
      email: customer.email,
      name: customer.name,
      plan: customer.plan,
      mrr: customer.mrr,
      health_score: customer.health_score,
      health_status: customer.health_score >= 80 ? 'healthy' : customer.health_score >= 50 ? 'warning' : 'critical',
      open_alerts: customer.open_alerts_count,
      open_tickets: customer.support_tickets_count,
      last_contact: customer.last_contact_at,
      created_at: customer.created_at
    }))

    const stats = {
      total: count || 0,
      healthy: enrichedCustomers.filter(c => c.health_status === 'healthy').length,
      warning: enrichedCustomers.filter(c => c.health_status === 'warning').length,
      critical: enrichedCustomers.filter(c => c.health_status === 'critical').length,
      total_mrr: enrichedCustomers.reduce((sum, c) => sum + (c.mrr || 0), 0),
      avg_health_score: enrichedCustomers.length > 0 
        ? Math.round(enrichedCustomers.reduce((sum, c) => sum + (c.health_score || 0), 0) / enrichedCustomers.length)
        : 0
    }

    return NextResponse.json({
      data: enrichedCustomers,
      stats,
      total: count,
      limit,
      offset,
      request_id: requestId
    })

  } catch (error: any) {
    console.error(`[${requestId}] Error in /api/customers/overview:`, error)
    return NextResponse.json({
      error: 'Internal server error',
      request_id: requestId
    }, { status: 500 })
  }
}
