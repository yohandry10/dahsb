import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

function generateIdempotencyKey(data: any): string {
  const crypto = require('crypto')
  const hash = crypto.createHash('sha256')
  hash.update(JSON.stringify(data))
  return hash.digest('hex').substring(0, 32)
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    const body = await request.json()
    const idempotencyKey = request.headers.get('x-idempotency-key') || generateIdempotencyKey(body)

    const { 
      organization_id,
      ticket_external_id,
      customer_email,
      customer_name,
      subject,
      description,
      priority,
      channel,
      tags,
      metadata 
    } = body

    if (!organization_id) {
      return NextResponse.json(
        { error: 'Missing organization_id', request_id: requestId },
        { status: 400 }
      )
    }

    if (!subject) {
      return NextResponse.json(
        { error: 'Missing subject', request_id: requestId },
        { status: 400 }
      )
    }

    const existingLog = await supabase
      .from('intake_logs')
      .select('id, processed')
      .eq('idempotency_key', idempotencyKey)
      .eq('organization_id', organization_id)
      .single()

    if (existingLog.data?.processed) {
      return NextResponse.json({
        message: 'Support ticket already processed',
        request_id: requestId
      }, { status: 200 })
    }

    const slaDeadline = new Date(Date.now() + (priority === 'high' ? 4 : priority === 'medium' ? 24 : 72) * 60 * 60 * 1000)

    const { data: supportTicket, error } = await supabase
      .from('support_tickets')
      .insert({
        organization_id,
        ticket_external_id: ticket_external_id || idempotencyKey,
        customer_email: customer_email || 'unknown',
        customer_name: customer_name || null,
        subject,
        description: description || null,
        priority: priority || 'medium',
        status: 'open',
        channel: channel || 'api',
        sla_deadline: slaDeadline.toISOString(),
        tags: tags || [],
        metadata: metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error(`[${requestId}] Failed to create support ticket:`, error)
      return NextResponse.json({
        error: 'Failed to create support ticket',
        request_id: requestId
      }, { status: 500 })
    }

    await supabase.from('intake_logs').insert({
      organization_id,
      intake_type: 'support',
      external_id: supportTicket?.id,
      payload: body,
      idempotency_key: idempotencyKey,
      processed: true,
      status: 'processed'
    })

    await supabase.from('metrics').insert({
      organization_id,
      metric_name: 'intake.support_ticket',
      metric_value: 1,
      metric_type: 'counter',
      tags: { priority: priority || 'medium', channel: channel || 'api' }
    })

    return NextResponse.json({
      success: true,
      id: supportTicket?.id,
      request_id: requestId,
      sla_deadline: slaDeadline.toISOString(),
      message: 'Support ticket created'
    }, { status: 201 })

  } catch (error: any) {
    console.error(`[${requestId}] Error in /api/intake/support:`, error)
    return NextResponse.json({
      error: 'Internal server error',
      request_id: requestId
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    const searchParams = request.nextUrl.searchParams
    const organization_id = searchParams.get('organization_id')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!organization_id) {
      return NextResponse.json(
        { error: 'Missing organization_id', request_id: requestId },
        { status: 400 }
      )
    }

    let query = supabase
      .from('support_tickets')
      .select('*', { count: 'exact' })
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (priority) query = query.eq('priority', priority)

    const { data, count, error } = await query

    if (error) {
      console.error(`[${requestId}] Failed to fetch support tickets:`, error)
      return NextResponse.json({
        error: 'Failed to fetch support tickets',
        request_id: requestId
      }, { status: 500 })
    }

    const statsQuery = await supabase
      .from('support_tickets')
      .select('status, priority', { count: 'exact' })
      .eq('organization_id', organization_id)

    const stats = {
      total: count || 0,
      open: statsQuery.data?.filter(t => t.status === 'open').length || 0,
      high_priority: statsQuery.data?.filter(t => t.priority === 'high' && t.status === 'open').length || 0,
      sla_breached: statsQuery.data?.filter(t => t.status === 'open' && new Date(t.sla_deadline) < new Date()).length || 0
    }

    return NextResponse.json({
      data: data || [],
      count,
      stats,
      limit,
      offset,
      request_id: requestId
    })

  } catch (error: any) {
    console.error(`[${requestId}] Error in GET /api/intake/support:`, error)
    return NextResponse.json({
      error: 'Internal server error',
      request_id: requestId
    }, { status: 500 })
  }
}
