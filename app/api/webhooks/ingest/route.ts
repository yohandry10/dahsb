import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Validate HMAC signature
function validateHMAC(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return hash === signature
}

// Get organization by API key
async function getOrgBySecret(secret: string) {
  const { data, error } = await supabase
    .from('orgs')
    .select('*')
    .eq('webhook_secret', secret)
    .single()

  if (error || !data) {
    return null
  }
  return data
}

// Check rate limit
async function checkRateLimit(
  org_id: string,
  limit: number
): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()

  const { count, error } = await supabase
    .from('webhook_logs')
    .select('*', { count: 'exact' })
    .eq('org_id', org_id)
    .gte('created_at', oneMinuteAgo)

  if (error) {
    console.error('[v0] Rate limit check error:', error)
    return false
  }

  return (count || 0) < limit
}

// Check idempotency
async function isIdempotent(
  org_id: string,
  idempotency_key: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('webhook_logs')
    .select('id, processed')
    .eq('org_id', org_id)
    .eq('idempotency_key', idempotency_key)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[v0] Idempotency check error:', error)
    return false
  }

  // If we found a processed webhook with this key, it's idempotent
  return data ? data.processed : true
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('x-webhook-signature')
    const idempotencyKey = request.headers.get('x-idempotency-key')
    const webhookType = request.headers.get('x-webhook-type') || 'unknown'

    // Validate signature is provided
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing webhook signature' },
        { status: 401 }
      )
    }

    // Validate idempotency key is provided
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'Missing idempotency key' },
        { status: 400 }
      )
    }

    // Extract secret from signature header (format: "Secret secret_value")
    const secretMatch = signature.match(/Secret\s+(.+)/)
    if (!secretMatch) {
      return NextResponse.json(
        { error: 'Invalid signature format' },
        { status: 401 }
      )
    }

    const secret = secretMatch[1]

    // Get organization
    const org = await getOrgBySecret(secret)
    if (!org) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      )
    }

    // Check rate limit
    const withinLimit = await checkRateLimit(org.id, org.rate_limit_per_minute)
    if (!withinLimit) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Check idempotency
    const isNew = await isIdempotent(org.id, idempotencyKey)
    if (!isNew) {
      console.log('[v0] Duplicate webhook received (idempotent), returning success')
      return NextResponse.json(
        { message: 'Webhook already processed' },
        { status: 200 }
      )
    }

    // Validate HMAC
    const isValid = validateHMAC(payload, signature, secret)
    if (!isValid) {
      // Log failed attempt
      await supabase.from('webhook_logs').insert({
        org_id: org.id,
        webhook_type: webhookType,
        payload: { raw: payload.substring(0, 100) },
        status_code: 401,
        error_message: 'HMAC validation failed',
        idempotency_key: idempotencyKey,
        processed: false,
      })

      return NextResponse.json(
        { error: 'Signature validation failed' },
        { status: 401 }
      )
    }

    // Parse payload
    let webhookData: any
    try {
      webhookData = JSON.parse(payload)
    } catch (e) {
      await supabase.from('webhook_logs').insert({
        org_id: org.id,
        webhook_type: webhookType,
        payload: { raw: payload.substring(0, 100) },
        status_code: 400,
        error_message: 'Invalid JSON payload',
        idempotency_key: idempotencyKey,
        processed: false,
      })

      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Log webhook reception
    const { data: logData, error: logError } = await supabase
      .from('webhook_logs')
      .insert({
        org_id: org.id,
        webhook_type: webhookType,
        payload: webhookData,
        idempotency_key: idempotencyKey,
        processed: false,
      })
      .select()
      .single()

    if (logError) {
      console.error('[v0] Failed to log webhook:', logError)
      return NextResponse.json(
        { error: 'Failed to process webhook' },
        { status: 500 }
      )
    }

    // Create alert from webhook data
    const alertData = {
      org_id: org.id,
      source: webhookData.source || 'unknown',
      title: webhookData.title || 'Untitled Alert',
      description: webhookData.description || null,
      severity: webhookData.severity || 'info',
      status: 'open',
      tags: webhookData.tags || [],
      metadata: webhookData.metadata || {},
      created_by: webhookData.created_by || 'webhook',
    }

    const { data: alertInsertData, error: alertError } = await supabase
      .from('alerts')
      .insert(alertData)
      .select()
      .single()

    if (alertError) {
      console.error('[v0] Failed to create alert:', alertError)
      // Mark webhook log as failed
      await supabase
        .from('webhook_logs')
        .update({
          status_code: 500,
          error_message: alertError.message,
          processed: false,
        })
        .eq('id', logData.id)

      return NextResponse.json(
        { error: 'Failed to create alert' },
        { status: 500 }
      )
    }

    // Mark webhook as processed
    await supabase
      .from('webhook_logs')
      .update({
        status_code: 200,
        processed: true,
      })
      .eq('id', logData.id)

    console.log('[v0] Alert created successfully:', alertInsertData.id)

    return NextResponse.json(
      {
        message: 'Webhook processed successfully',
        alert_id: alertInsertData.id,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[v0] Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
