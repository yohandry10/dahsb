import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const organization_id = searchParams.get('organization_id')
  const metric_name = searchParams.get('metric_name')
  const hours = parseInt(searchParams.get('hours') || '24')

  try {
    let query = supabase
      .from('metrics')
      .select('*')
      .gte('recorded_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('recorded_at', { ascending: false })

    if (organization_id) {
      query = query.eq('organization_id', organization_id)
    }

    if (metric_name) {
      query = query.eq('metric_name', metric_name)
    }

    const { data: metrics, error } = await query

    if (error) throw error

    const summary = (metrics || []).reduce((acc: any, m) => {
      if (!acc[m.metric_name]) {
        acc[m.metric_name] = { count: 0, total: 0, avg: 0 }
      }
      acc[m.metric_name].count++
      acc[m.metric_name].total += Number(m.metric_value) || 0
      return acc
    }, {})

    for (const key in summary) {
      summary[key].avg = summary[key].total / summary[key].count
    }

    const health = {
      total_events: metrics?.length || 0,
      by_metric: summary,
      time_range_hours: hours
    }

    return NextResponse.json({
      data: metrics || [],
      summary: health
    })

  } catch (error: any) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json({
      error: 'Failed to fetch metrics'
    }, { status: 500 })
  }
}
