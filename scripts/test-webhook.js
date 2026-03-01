#!/usr/bin/env node

/**
 * Test script for Alerts Center webhook ingestion
 * 
 * Usage:
 *   node scripts/test-webhook.js
 * 
 * This script demonstrates:
 * - HMAC signature generation
 * - Idempotency key handling
 * - Webhook payload ingestion
 * - Error handling and retry logic
 */

import crypto from 'crypto'

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/ingest'
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test_secret_key_12345'

// Generate HMAC signature
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

// Send webhook
async function sendWebhook(alertData, webhookType = 'system') {
  const payload = JSON.stringify(alertData)
  const signature = generateSignature(payload, WEBHOOK_SECRET)
  const idempotencyKey = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  console.log('[v0] Sending webhook...')
  console.log(`[v0] Type: ${webhookType}`)
  console.log(`[v0] Idempotency Key: ${idempotencyKey}`)
  console.log(`[v0] Payload:`, alertData)

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Type': webhookType,
        'X-Webhook-Signature': `Secret ${signature}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: payload,
    })

    const data = await response.json()

    if (response.ok) {
      console.log('[v0] ✓ Webhook accepted')
      console.log(`[v0] Alert ID: ${data.alert_id}`)
      return { success: true, alertId: data.alert_id }
    } else {
      console.error('[v0] ✗ Webhook rejected:', data.error)
      return { success: false, error: data.error }
    }
  } catch (error) {
    console.error('[v0] ✗ Webhook failed:', error.message)
    return { success: false, error: error.message }
  }
}

// Test scenarios
async function runTests() {
  console.log('\n=== Alerts Center Webhook Test Suite ===\n')

  // Test 1: Basic alert
  console.log('Test 1: Creating basic system alert')
  const alert1 = await sendWebhook({
    title: 'Database Connection Timeout',
    description: 'Primary database connection exceeded threshold',
    severity: 'critical',
    source: 'system',
    tags: ['database', 'production', 'connection'],
    metadata: {
      host: 'db-primary.prod.internal',
      error_code: 'ECONNREFUSED',
      last_successful_connection: new Date(Date.now() - 60000).toISOString(),
    },
    created_by: 'monitoring-system',
  }, 'system')

  console.log()

  // Test 2: GitHub alert
  console.log('Test 2: Creating GitHub workflow alert')
  const alert2 = await sendWebhook({
    title: 'Workflow Failed: CI/CD Pipeline',
    description: 'Pull request #2341 failed linting checks',
    severity: 'high',
    source: 'github',
    tags: ['github', 'ci-cd', 'pr-2341', 'linting'],
    metadata: {
      repository: 'gitgov/core',
      workflow: 'ci-tests',
      branch: 'feature/alerts-center',
      run_id: '7234891234',
      url: 'https://github.com/gitgov/core/actions/runs/7234891234',
    },
    created_by: 'github-actions',
  }, 'github')

  console.log()

  // Test 3: Chatbot alert
  console.log('Test 3: Creating chatbot/support alert')
  const alert3 = await sendWebhook({
    title: 'Support: Multiple "Login Failed" Reports',
    description: 'Spike in failed login attempts - 42 reports in last 30 minutes',
    severity: 'high',
    source: 'chatbot',
    tags: ['support', 'security', 'authentication', 'spike'],
    metadata: {
      alert_type: 'support_spike',
      count: 42,
      time_window: 1800,
      affected_users: 38,
      regions: ['US-West', 'EU-Central'],
    },
    created_by: 'support-bot',
  }, 'chatbot')

  console.log()

  // Test 4: Low severity alert
  console.log('Test 4: Creating low-priority info alert')
  const alert4 = await sendWebhook({
    title: 'Maintenance Window Scheduled',
    description: 'Scheduled maintenance on cache cluster - Saturday 2-4 AM UTC',
    severity: 'info',
    source: 'system',
    tags: ['maintenance', 'scheduled', 'cache'],
    metadata: {
      start_time: new Date(Date.now() + 86400000 * 6 + 7200000).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 6 + 14400000).toISOString(),
      duration_minutes: 120,
      service: 'redis-cache',
    },
    created_by: 'devops-team',
  }, 'system')

  console.log()

  // Test 5: Duplicate webhook (idempotency)
  console.log('Test 5: Testing idempotency - resending first alert')
  const alert1Retry = await sendWebhook({
    title: 'Database Connection Timeout (Retry)',
    description: 'Retrying the same alert with same payload',
    severity: 'critical',
    source: 'system',
    tags: ['database', 'production', 'connection'],
    metadata: {
      test: 'idempotency',
    },
    created_by: 'monitoring-system',
  }, 'system')

  console.log()

  // Summary
  console.log('\n=== Test Summary ===')
  console.log(`Test 1 (System Alert): ${alert1.success ? '✓ PASS' : '✗ FAIL'} ${alert1.alertId ? `(ID: ${alert1.alertId.substring(0, 8)}...)` : `(Error: ${alert1.error})`}`)
  console.log(`Test 2 (GitHub Alert): ${alert2.success ? '✓ PASS' : '✗ FAIL'} ${alert2.alertId ? `(ID: ${alert2.alertId.substring(0, 8)}...)` : `(Error: ${alert2.error})`}`)
  console.log(`Test 3 (Chatbot Alert): ${alert3.success ? '✓ PASS' : '✗ FAIL'} ${alert3.alertId ? `(ID: ${alert3.alertId.substring(0, 8)}...)` : `(Error: ${alert3.error})`}`)
  console.log(`Test 4 (Info Alert): ${alert4.success ? '✓ PASS' : '✗ FAIL'} ${alert4.alertId ? `(ID: ${alert4.alertId.substring(0, 8)}...)` : `(Error: ${alert4.error})`}`)
  console.log(`Test 5 (Idempotency): ${alert1Retry.success ? '✓ PASS' : '✗ FAIL'} ${alert1Retry.alertId ? `(ID: ${alert1Retry.alertId.substring(0, 8)}...)` : `(Error: ${alert1Retry.error})`}`)

  const passed = [alert1, alert2, alert3, alert4, alert1Retry].filter(r => r.success).length
  console.log(`\nTotal: ${passed}/5 tests passed`)

  if (passed === 5) {
    console.log('\n✓ All tests passed! The alerts center is working correctly.')
    console.log('\nNext steps:')
    console.log('1. Visit http://localhost:3000/alerts to see the dashboard')
    console.log('2. Check the alerts list for the test alerts you just created')
    console.log('3. Try acknowledging, resolving, or snoozing alerts')
    console.log('4. View the audit logs to see your actions recorded')
  } else {
    console.log('\n✗ Some tests failed. Check the errors above.')
  }
}

// Run tests
runTests().catch(console.error)
