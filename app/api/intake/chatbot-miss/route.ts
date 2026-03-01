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
      user_id,
      user_email,
      question,
      answer,
      intent,
      confidence_score,
      was_supported,
      was_escalated,
      session_id,
      metadata 
    } = body

    if (!organization_id) {
      return NextResponse.json(
        { error: 'Missing organization_id', request_id: requestId },
        { status: 400 }
      )
    }

    if (!question) {
      return NextResponse.json(
        { error: 'Missing question', request_id: requestId },
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
        message: 'Chatbot request already processed',
        request_id: requestId
      }, { status: 200 })
    }

    const { data: chatbotRequest, error } = await supabase
      .from('chatbot_requests')
      .insert({
        organization_id,
        user_id: user_id || null,
        user_email: user_email || null,
        question,
        answer: answer || null,
        intent: intent || null,
        confidence_score: confidence_score || null,
        was_supported: was_supported !== undefined ? was_supported : false,
        was_escalated: was_escalated !== undefined ? was_escalated : false,
        session_id: session_id || null,
        metadata: metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error(`[${requestId}] Failed to create chatbot request:`, error)
      return NextResponse.json({
        error: 'Failed to process chatbot request',
        request_id: requestId
      }, { status: 500 })
    }

    await supabase.from('intake_logs').insert({
      organization_id,
      intake_type: 'chatbot_request',
      external_id: chatbotRequest?.id,
      payload: body,
      idempotency_key: idempotencyKey,
      processed: true,
      status: 'processed'
    })

    await supabase.from('metrics').insert({
      organization_id,
      metric_name: 'chatbot.request',
      metric_value: 1,
      metric_type: 'counter',
      tags: { 
        was_supported: String(was_supported || false),
        was_escalated: String(was_escalated || false),
        has_intent: intent ? 'true' : 'false'
      }
    })

    return NextResponse.json({
      success: true,
      id: chatbotRequest?.id,
      request_id: requestId,
      message: 'Chatbot request recorded'
    }, { status: 201 })

  } catch (error: any) {
    console.error(`[${requestId}] Error in /api/intake/chatbot-miss:`, error)
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
    const was_supported = searchParams.get('was_supported')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!organization_id) {
      return NextResponse.json(
        { error: 'Missing organization_id', request_id: requestId },
        { status: 400 }
      )
    }

    let query = supabase
      .from('chatbot_requests')
      .select('*', { count: 'exact' })
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (was_supported !== null) {
      query = query.eq('was_supported', was_supported === 'true')
    }

    const { data, count, error } = await query

    if (error) {
      console.error(`[${requestId}] Failed to fetch chatbot requests:`, error)
      return NextResponse.json({
        error: 'Failed to fetch chatbot requests',
        request_id: requestId
      }, { status: 500 })
    }

    const insights = {
      total: count || 0,
      unsupported: data?.filter(r => !r.was_supported).length || 0,
      escalated: data?.filter(r => r.was_escalated).length || 0,
      top_intents: (data || [])
        .filter(r => r.intent)
        .reduce((acc: any, r) => {
          acc[r.intent] = (acc[r.intent] || 0) + 1
          return acc
        }, {}),
      top_questions: (data || [])
        .filter(r => !r.was_supported)
        .slice(0, 10)
        .map(r => ({ question: r.question, count: 1 }))
    }

    return NextResponse.json({
      data: data || [],
      count,
      insights,
      limit,
      offset,
      request_id: requestId
    })

  } catch (error: any) {
    console.error(`[${requestId}] Error in GET /api/intake/chatbot-miss:`, error)
    return NextResponse.json({
      error: 'Internal server error',
      request_id: requestId
    }, { status: 500 })
  }
}
