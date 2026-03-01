# GitGov Alerts Center - Implementation Guide

## Overview

The Alerts Center is a full-stack independent Next.js application providing a unified dashboard for managing alerts from multiple sources including GitGov, chatbot events, and system notifications. It features HMAC-based webhook ingestion, multi-tenant support, audit logging, and a professional founder-focused UI.

## Architecture

### Components

1. **Database Layer** (`scripts/002_create_tables.sql`)
   - `orgs`: Organizations with webhook configuration
   - `alerts`: Alert records with status tracking
   - `audit_logs`: Founder action audit trail
   - `webhook_logs`: Webhook ingestion logs for debugging

2. **API Layer** (`app/api/`)
   - `/api/webhooks/ingest`: Webhook ingestion with HMAC validation
   - `/api/alerts`: Alert listing and filtering
   - `/api/alerts/[id]`: Alert details and actions
   - `/api/audit-logs`: Audit trail queries

3. **Frontend** (`app/alerts/`)
   - React dashboard with Zustand state management
   - Responsive sidebar with filtering
   - Alert list with status indicators
   - Detail panel with actions and audit logs

## Quick Start

### 1. Database Setup

Execute the migration to create all required tables:

```bash
# Using Supabase SQL Editor in dashboard:
# Open: https://app.supabase.com/project/[project-id]/sql
# Paste contents of: scripts/002_create_tables.sql
# Click "Run"
```

Or using Supabase CLI:

```bash
supabase db push
```

This creates:
- `orgs` table with webhook configuration
- `alerts` table with full alert lifecycle
- `audit_logs` table for founder action tracking
- `webhook_logs` table for webhook debugging

### 2. Environment Configuration

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
GITGOV_API_URL=https://api.gitgov.dev
GITGOV_API_KEY=sk_...
```

### 3. Create Test Organization

Insert a test organization:

```sql
INSERT INTO orgs (name, slug, webhook_secret, rate_limit_per_minute)
VALUES ('My Organization', 'my-org', 'test_secret_key_12345', 100);
```

### 4. Start Application

```bash
npm install
npm run dev
```

Visit: `http://localhost:3000/alerts?org_id=<your-org-id>`

## Webhook Integration

### Ingestion Endpoint

**URL:** `POST /api/webhooks/ingest`

**Headers:**
```
X-Webhook-Type: chatbot|system|github|gitgov
X-Webhook-Signature: Secret <HMAC-SHA256>
X-Idempotency-Key: unique-key-per-webhook
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Database Connection Timeout",
  "description": "Primary database connection exceeded threshold",
  "severity": "critical",
  "source": "github",
  "tags": ["database", "production"],
  "metadata": {
    "repository": "gitgov/core",
    "commit": "abc123",
    "workflow": "ci-tests"
  },
  "created_by": "github-actions"
}
```

### HMAC Signature Validation

Generate signature (Node.js example):

```javascript
const crypto = require('crypto');

const payload = JSON.stringify(alertData);
const secret = 'test_secret_key_12345';
const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

// Header format: "Secret <hex-signature>"
```

### Response

**Success (201):**
```json
{
  "message": "Webhook processed successfully",
  "alert_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:**
- `401 Unauthorized`: Missing or invalid signature/secret
- `400 Bad Request`: Missing required fields or invalid JSON
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Database error

## Alert Lifecycle

### States

- **open**: New alert, requires action
- **acknowledged**: Founder is aware, investigating
- **resolved**: Issue fixed or alert no longer relevant
- **snoozed**: Temporarily hidden for specified duration

### Actions

#### Acknowledge Alert
```javascript
await fetch('/api/alerts/{id}', {
  method: 'POST',
  body: JSON.stringify({
    action: 'acknowledge',
    actor: 'founder@company.com',
    reason: 'Investigating issue'
  })
});
```

#### Resolve Alert
```javascript
await fetch('/api/alerts/{id}', {
  method: 'POST',
  body: JSON.stringify({
    action: 'resolve',
    actor: 'founder@company.com',
    reason: 'Issue fixed in v1.2.0'
  })
});
```

#### Snooze Alert (1 hour)
```javascript
const snoozeUntil = new Date(Date.now() + 60 * 60 * 1000);
await fetch('/api/alerts/{id}', {
  method: 'POST',
  body: JSON.stringify({
    action: 'snooze',
    actor: 'founder@company.com',
    until: snoozeUntil.toISOString()
  })
});
```

## API Reference

### List Alerts

```
GET /api/alerts?org_id=<id>&status=open&severity=critical&limit=50&offset=0
```

Query Parameters:
- `org_id` (required): Organization UUID
- `status`: Filter by status (open|acknowledged|resolved|snoozed)
- `severity`: Filter by severity (critical|high|medium|low|info)
- `source`: Filter by source (github|gitgov|chatbot|system)
- `search`: Search in title and description
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset (default: 0)
- `stats`: Return statistics instead of alerts

### Get Alert Details

```
GET /api/alerts/{id}?audit=true
```

Query Parameters:
- `audit`: Include audit logs in response

### Get Audit Logs

```
GET /api/audit-logs?org_id=<id>&alert_id=<id>&limit=20
```

Query Parameters:
- `org_id` (required): Organization UUID
- `alert_id`: Filter by specific alert
- `limit`: Number of records (default: 50)
- `offset`: Pagination offset (default: 0)

## Security Considerations

### HMAC Validation

All webhooks must be signed with HMAC-SHA256 using the organization's webhook secret. Validation happens server-side.

### Rate Limiting

Per-organization rate limit (default: 100 requests/minute). Configurable in `orgs.rate_limit_per_minute`.

### Idempotency

All webhook ingestion requests must include `X-Idempotency-Key`. Duplicate requests with same key within 24 hours return success without creating duplicate alerts.

### Audit Logging

All founder actions (acknowledge, resolve, snooze, reopen) are logged with:
- Actor (email/identifier)
- Action type
- Timestamp
- Old/new state
- Optional reason
- IP address and user agent

## Filtering and Search

### By Status
Filter to show only open alerts:
```
/alerts?status=open
```

### By Severity
Show only critical and high severity:
```
/alerts?severity=critical
```

### By Source
Filter to GitHub alerts:
```
/alerts?source=github
```

### Full Text Search
Search in title and description:
```
/alerts?search=database+timeout
```

### Combine Filters
All filters can be combined:
```
/alerts?org_id=<id>&status=open&severity=high&source=github&search=timeout
```

## Multi-Tenancy

Each organization has:
- Unique webhook secret for authentication
- Rate limiting configuration
- Isolated alert data via `org_id` foreign key
- Separate audit logs for founder actions

Organizations are created in the `orgs` table with unique slugs.

## Debugging

### Webhook Logs

Check webhook ingestion attempts:

```sql
SELECT * FROM webhook_logs 
WHERE org_id = '<org-id>' 
AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC
LIMIT 20;
```

### Alert Audit Trail

View all actions on specific alert:

```sql
SELECT * FROM audit_logs 
WHERE alert_id = '<alert-id>'
ORDER BY created_at DESC;
```

### Failed Webhooks

Identify webhook processing failures:

```sql
SELECT * FROM webhook_logs 
WHERE processed = false 
AND status_code != 200
ORDER BY created_at DESC;
```

## Deployment

### To Vercel

```bash
git push origin main
```

Environment variables configured in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GITGOV_API_KEY` (optional)

### Database on Supabase

1. Create Supabase project
2. Run migration: `scripts/002_create_tables.sql`
3. Copy credentials to environment

## File Structure

```
/vercel/share/v0-project/
├── app/
│   ├── api/
│   │   ├── alerts/           # Alert query and action endpoints
│   │   ├── audit-logs/       # Audit trail endpoints
│   │   └── webhooks/ingest   # Webhook ingestion endpoint
│   └── alerts/
│       └── page.tsx          # Main dashboard page
├── components/
│   ├── alerts-header.tsx     # Dashboard header with stats
│   ├── alerts-filters.tsx    # Filtering sidebar
│   ├── alerts-list.tsx       # Alert list view
│   └── alert-detail.tsx      # Alert detail panel
├── lib/
│   ├── api-client.ts         # Supabase client and helper functions
│   └── store.ts              # Zustand state management
├── scripts/
│   └── 002_create_tables.sql # Database migration
├── .env.example              # Environment variables template
└── ALERTS_CENTER_GUIDE.md    # This file
```

## Monitoring and Metrics

### Track Alert Metrics

```sql
-- Alert distribution by status
SELECT status, COUNT(*) as count
FROM alerts
WHERE org_id = '<org-id>'
GROUP BY status;

-- Alert distribution by severity
SELECT severity, COUNT(*) as count
FROM alerts
WHERE org_id = '<org-id>' AND created_at > now() - interval '24 hours'
GROUP BY severity;

-- Most common alert sources
SELECT source, COUNT(*) as count
FROM alerts
WHERE org_id = '<org-id>' AND created_at > now() - interval '7 days'
GROUP BY source
ORDER BY count DESC;
```

## Troubleshooting

### Webhooks not being received?

1. Verify webhook secret matches in both webhook sender and `orgs.webhook_secret`
2. Check HMAC signature calculation
3. Ensure `X-Idempotency-Key` is unique per webhook
4. Review webhook logs: `SELECT * FROM webhook_logs WHERE org_id = '<id>' ORDER BY created_at DESC LIMIT 20`

### Alerts not appearing in UI?

1. Verify organization UUID in URL query parameter
2. Check Supabase RLS policies are not blocking queries
3. Verify user has access to organization data
4. Check browser console for API errors

### Rate limiting issues?

1. Check current request count: `SELECT COUNT(*) FROM webhook_logs WHERE org_id = '<id>' AND created_at > now() - interval '1 minute'`
2. Adjust rate limit: `UPDATE orgs SET rate_limit_per_minute = 200 WHERE id = '<org-id>'`
3. Implement request batching on client side

## Support

For issues or questions:
1. Check webhook logs for ingestion errors
2. Review audit logs for action history
3. Check database schema and indexes
4. Verify environment variables are set correctly

## Future Enhancements

- WebSocket real-time updates instead of polling
- Email/Slack notifications for critical alerts
- Custom alert grouping and correlation
- Advanced filtering with saved views
- Integration with external incident management tools
- Alert history and trend analysis
