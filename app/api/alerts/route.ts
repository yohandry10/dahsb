import { NextRequest, NextResponse } from 'next/server'
import { getAlerts, getAlertStats } from '@/lib/api-client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const org_id = searchParams.get('org_id')
    const status = searchParams.get('status')
    const severity = searchParams.get('severity')
    const source = searchParams.get('source')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const stats = searchParams.get('stats') === 'true'

    if (!org_id) {
      return NextResponse.json(
        { error: 'Missing org_id parameter' },
        { status: 400 }
      )
    }

    if (stats) {
      const alertStats = await getAlertStats(org_id)
      return NextResponse.json(alertStats)
    }

    const alerts = await getAlerts(org_id, {
      status: status || undefined,
      severity: severity || undefined,
      source: source || undefined,
      search: search || undefined,
      limit,
      offset,
    })

    return NextResponse.json({
      data: alerts,
      count: alerts?.length || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[v0] GET /api/alerts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}
