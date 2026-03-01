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
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const idempotencyKey = request.headers.get('x-idempotency-key') || generateIdempotencyKey(body)

    const { 
      organization_id,
      source,
      title,
      description,
      severity,
      tags,
      metadata 
    } = body

    if (!organization_id) {
      return NextResponse.json(
        { error: 'Missing organization_id', request_id: requestId },
        { status: 400 }
      )
    }

    const existingLog = await supabase
      .from('webhook_logs')
      .select('id, processed')
      .eq('idempotency_key', idempotencyKey)
      .eq('organization_id', organization_id)
      .single()

    if (existingLog.data?.processed) {
      await supabase.from('metrics').insert({
        organization_id,
        metric_name: 'intake.duplicate',
        metric_value: 1,
        metric_type: 'counter',
        tags: { source: 'system-alert', request_id: requestId }
      })
      
      return NextResponse.json({
        message: 'System alert already processed',
        request_id: requestId
      }, { status: 200 })
    }

    const alertData = {
      organization_id,
      source: source || 'system',
      source_type: 'system-alert',
      title: title || 'System Alert',
      description: description || null,
      severity: severity || 'info',
      status: 'open',
      tags: tags || [],
      metadata: metadata || {},
      created_by: 'system'
    }

    const { data: alert, error } = await supabase
      .from('alerts')
      .insert(alertData)
      .select()
      .single()

    if (error) {
      const processingTime = Date.now() - startTime
      
      await supabase.from('webhook_logs').insert({
        organization_id,
        webhook_type: 'system-alert',
        source: source || 'system',
        payload: body,
        status_code: 500,
        error_message: error.message,
        idempotency_key: idempotencyKey,
        request_id: requestId,
        processing_time_ms: processingTime,
        processed: false
      })

      await supabase.from('metrics').insert({
        organization_id,
        metric_name: 'intake.error',
        metric_value: 1,
        metric_type: 'counter',
        tags: { source: 'system-alert', error: 'db_error', request_id: requestId }
      })

      console.error(`[${requestId}] Failed to create system alert:`, error)
      return NextResponse.json({
        error: 'Failed to create system alert',
        request_id: requestId
      }, { status: 500 })
    }

    const processingTime = Date.now() - startTime

    await supabase.from('webhook_logs').insert({
      organization_id,
      webhook_type: 'system-alert',
      source: source || 'system',
      payload: body,
      status_code: 201,
      idempotency_key: idempotencyKey,
      request_id: requestId,
      processing_time_ms: processingTime,
      processed: true
    })

    await supabase.from('metrics').insert([
      {
        organization_id,
        metric_name: 'intake.system_alert',
        metric_value: 1,
        metric_type: 'counter',
        tags: { severity: severity || 'info', request_id: requestId }
      },
      {
        organization_id,
        metric_name: 'ingestion.latency',
        metric_value: processingTime,
        metric_type: 'gauge',
        tags: { endpoint: 'system-alert', request_id: requestId }
      }
    ])

    return NextResponse.json({
      success: true,
      id: alert?.id,
      request_id: requestId,
      message: 'System alert created'
    }, { status: 201 })

  } catch (error: any) {
    const processingTime = Date.now() - startTime
    console.error(`[${requestId}] Error in /api/intake/system-alert:`, error)

    await supabase.from('metrics').insert({
      organization_id: body?.organization_id || 'unknown',
      metric_name: 'intake.error',
      metric_value: 1,
      metric_type: 'counter',
      tags: { source: 'system-alert', error: 'exception', request_id: requestId }
    })

    return NextResponse.json({
      error: 'Internal server error',
      request_id: requestId
    }, { status: 500 })
  }
}
