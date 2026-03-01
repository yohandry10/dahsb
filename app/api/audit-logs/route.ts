import { NextRequest, NextResponse } from 'next/server'
import { getAuditLogs } from '@/lib/api-client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const org_id = searchParams.get('org_id')
    const alert_id = searchParams.get('alert_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!org_id) {
      return NextResponse.json(
        { error: 'Missing org_id parameter' },
        { status: 400 }
      )
    }

    const auditLogs = await getAuditLogs(
      org_id,
      alert_id || undefined,
      { limit, offset }
    )

    return NextResponse.json({
      data: auditLogs,
      count: auditLogs?.length || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[v0] GET /api/audit-logs error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
