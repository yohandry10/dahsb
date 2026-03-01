import { NextRequest, NextResponse } from 'next/server'
import {
  getAlert,
  updateAlertStatus,
  snoozeAlert,
  getAuditLogs,
} from '@/lib/api-client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const withAudit = searchParams.get('audit') === 'true'

    const alert = await getAlert(id)

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      )
    }

    const response: any = { data: alert }

    if (withAudit) {
      const auditLogs = await getAuditLogs(alert.org_id, id, { limit: 50 })
      response.audit = auditLogs
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[v0] GET /api/alerts/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alert' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, actor, reason } = body

    if (!action || !actor) {
      return NextResponse.json(
        { error: 'Missing action or actor' },
        { status: 400 }
      )
    }

    const alert = await getAlert(id)
    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      )
    }

    let updated
    switch (action) {
      case 'acknowledge':
        updated = await updateAlertStatus(id, 'acknowledged', actor, reason)
        break

      case 'resolve':
        updated = await updateAlertStatus(id, 'resolved', actor, reason)
        break

      case 'reopen':
        updated = await updateAlertStatus(id, 'open', actor, reason)
        break

      case 'snooze':
        const { until } = body
        if (!until) {
          return NextResponse.json(
            { error: 'Missing snooze until time' },
            { status: 400 }
          )
        }
        updated = await snoozeAlert(id, new Date(until), actor)
        break

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }

    console.log('[v0] Alert action completed:', { id, action, actor })

    return NextResponse.json({
      message: `Alert ${action}ed successfully`,
      data: updated,
    })
  } catch (error) {
    console.error('[v0] POST /api/alerts/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    )
  }
}
