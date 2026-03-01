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
      feature_name,
      description,
      requested_by,
      customer_email,
      tags,
      metadata 
    } = body

    if (!organization_id) {
      return NextResponse.json(
        { error: 'Missing organization_id', request_id: requestId },
        { status: 400 }
      )
    }

    if (!feature_name) {
      return NextResponse.json(
        { error: 'Missing feature_name', request_id: requestId },
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
        message: 'Feature request already processed',
        request_id: requestId
      }, { status: 200 })
    }

    const { data: featureRequest, error } = await supabase
      .from('intake_logs')
      .insert({
        organization_id,
        intake_type: 'feature_request',
        external_id: idempotencyKey,
        payload: {
          feature_name,
          description,
          requested_by: requested_by || customer_email,
          customer_email,
          tags: tags || [],
          metadata: metadata || {}
        },
        idempotency_key: idempotencyKey,
        processed: true,
        status: 'processed'
      })
      .select()
      .single()

    if (error) {
      console.error(`[${requestId}] Failed to create feature request:`, error)
      return NextResponse.json({
        error: 'Failed to process feature request',
        request_id: requestId
      }, { status: 500 })
    }

    await supabase.from('metrics').insert({
      organization_id,
      metric_name: 'intake.feature_request',
      metric_value: 1,
      metric_type: 'counter',
      tags: { source: 'api' }
    })

    return NextResponse.json({
      success: true,
      id: featureRequest?.id,
      request_id: requestId,
      message: 'Feature request received'
    }, { status: 201 })

  } catch (error: any) {
    console.error(`[${requestId}] Error in /api/intake/feature-request:`, error)
    return NextResponse.json({
      error: 'Internal server error',
      request_id: requestId
    }, { status: 500 })
  }
}
