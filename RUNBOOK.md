# Alerts Center - Operations Runbook

## Deployment Checklist

### Pre-Deployment

- [ ] All tests pass: `npm run test`
- [ ] Code review completed
- [ ] Environment variables are set in Vercel dashboard
- [ ] Database backup taken in Supabase
- [ ] Alert threshold monitoring is active

### Database Migration

1. **Backup current database**
   ```bash
   # Via Supabase dashboard: Database → Backups → Request backup
   ```

2. **Run migration in Supabase**
   ```bash
   # Option A: Via Supabase SQL Editor
   # 1. Dashboard → SQL Editor
   # 2. Create new query
   # 3. Paste contents of scripts/002_create_tables.sql
   # 4. Review and click "Run"

   # Option B: Via Supabase CLI
   supabase db push
   ```

3. **Verify tables created**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

4. **Check indexes**
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE schemaname = 'public' 
   AND tablename IN ('alerts', 'audit_logs', 'webhook_logs');
   ```

### Deployment to Vercel

1. **Push to main branch**
   ```bash
   git add .
   git commit -m "feat: add alerts center full-stack implementation"
   git push origin main
   ```

2. **Verify deployment** 
   ```bash
   # Check Vercel dashboard or use CLI
   vercel ls
   ```

3. **Test in production**
   ```bash
   # Run test webhook against deployed instance
   WEBHOOK_URL=https://your-domain.vercel.app/api/webhooks/ingest \
   WEBHOOK_SECRET=your_secret \
   node scripts/test-webhook.js
   ```

## Operational Tasks

### Adding New Organization

```sql
-- Create new organization with webhook
INSERT INTO orgs (name, slug, webhook_secret, rate_limit_per_minute)
VALUES (
  'Acme Corp',
  'acme-corp',
  'sk_acme_' || encode(gen_random_bytes(32), 'hex'),
  100
);

-- Get the organization ID
SELECT id, name, webhook_secret FROM orgs WHERE slug = 'acme-corp';
```

### Adjusting Rate Limits

```sql
-- Increase rate limit for high-volume organization
UPDATE orgs 
SET rate_limit_per_minute = 500
WHERE slug = 'acme-corp';
```

### Rotating Webhook Secret

```sql
-- Generate new secret
UPDATE orgs
SET webhook_secret = 'sk_' || encode(gen_random_bytes(32), 'hex'),
    updated_at = NOW()
WHERE slug = 'acme-corp'
RETURNING id, webhook_secret;

-- Notify organization to update their integration
```

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Webhook Success Rate**
   ```sql
   SELECT 
     DATE_TRUNC('hour', created_at) as hour,
     COUNT(*) as total,
     COUNT(CASE WHEN processed = true THEN 1 END) as successful,
     ROUND(100.0 * COUNT(CASE WHEN processed = true THEN 1 END) / COUNT(*), 2) as success_rate
   FROM webhook_logs
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY DATE_TRUNC('hour', created_at)
   ORDER BY hour DESC;
   ```

2. **Alert Volume by Severity**
   ```sql
   SELECT severity, COUNT(*) as count
   FROM alerts
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY severity
   ORDER BY count DESC;
   ```

3. **Open Alerts by Organization**
   ```sql
   SELECT 
     o.name,
     COUNT(a.id) as open_count
   FROM orgs o
   LEFT JOIN alerts a ON o.id = a.org_id AND a.status = 'open'
   GROUP BY o.id, o.name
   ORDER BY open_count DESC;
   ```

4. **Webhook Failure Analysis**
   ```sql
   SELECT 
     webhook_type,
     status_code,
     error_message,
     COUNT(*) as count
   FROM webhook_logs
   WHERE processed = false
   AND created_at > NOW() - INTERVAL '1 day'
   GROUP BY webhook_type, status_code, error_message
   ORDER BY count DESC;
   ```

### Alert Configuration in Monitoring Tool

Set up alerts for:

- [ ] Webhook success rate < 95%
- [ ] API response time > 500ms
- [ ] Database connection errors
- [ ] High volume of critical severity alerts
- [ ] Duplicate webhook ingestion attempts

## Troubleshooting

### Issue: Webhooks Not Being Received

**Diagnosis:**
```sql
-- Check webhook logs for the organization
SELECT * FROM webhook_logs 
WHERE org_id = '<org-id>'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;

-- Check for HMAC validation failures
SELECT COUNT(*) as failed_hmac_count
FROM webhook_logs
WHERE error_message LIKE 'HMAC%'
AND created_at > NOW() - INTERVAL '1 hour';
```

**Solutions:**
1. Verify webhook secret matches in both systems
2. Ensure HMAC signature calculation is correct
3. Check webhook sender is using POST method
4. Verify Content-Type header is application/json
5. Review API logs in Vercel dashboard

### Issue: Duplicate Alerts Being Created

**Diagnosis:**
```sql
-- Find duplicate alerts with same title within time window
SELECT 
  title,
  COUNT(*) as count,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM alerts
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY title
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Check webhook_logs for duplicate idempotency keys
SELECT 
  idempotency_key,
  COUNT(*) as count,
  STRING_AGG(id::text, ',') as ids
FROM webhook_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY idempotency_key
HAVING COUNT(*) > 1;
```

**Solutions:**
1. Ensure webhook sender is generating unique idempotency keys
2. Verify idempotency key header is being sent
3. Check that webhook keys aren't being recycled too quickly

### Issue: High API Response Times

**Diagnosis:**
```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM alerts 
WHERE org_id = '<org-id>' 
AND status = 'open'
ORDER BY created_at DESC 
LIMIT 50;

-- Check database connection pool usage
SELECT count(*) from pg_stat_activity;

-- Find slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Solutions:**
1. Ensure all indexes are created: `scripts/002_create_tables.sql`
2. Increase API cache if applicable
3. Consider partitioning large alerts table by org_id
4. Add read-only replica for heavy queries
5. Implement caching layer (Redis)

### Issue: Rate Limiting Too Restrictive

**Diagnosis:**
```sql
-- Check current request rate for organization
SELECT 
  org_id,
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as requests
FROM webhook_logs
WHERE org_id = '<org-id>'
AND created_at > NOW() - INTERVAL '10 minutes'
GROUP BY org_id, DATE_TRUNC('minute', created_at)
ORDER BY minute DESC;

-- Check configured rate limit
SELECT id, name, rate_limit_per_minute FROM orgs 
WHERE id = '<org-id>';
```

**Solution:**
```sql
UPDATE orgs 
SET rate_limit_per_minute = <new_limit>
WHERE id = '<org-id>';
```

## Maintenance Tasks

### Weekly

1. Review webhook failure logs
2. Check database size growth
3. Verify all organizations' webhooks are functioning
4. Review alert closure rates

### Monthly

1. Analyze alert patterns and trends
2. Review and update alert rules
3. Clean up resolved alerts older than retention period
4. Review audit logs for security audit
5. Test disaster recovery plan

### Quarterly

1. Update security patches
2. Review and update rate limits for all organizations
3. Performance optimization review
4. Update monitoring and alerting rules

## Performance Tuning

### Database Optimization

```sql
-- Analyze and vacuum
ANALYZE alerts;
ANALYZE audit_logs;
ANALYZE webhook_logs;
VACUUM ANALYZE;

-- Monitor table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index effectiveness
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### API Optimization

1. Enable caching headers for GET requests
2. Implement pagination limits
3. Add database query timeouts
4. Monitor and optimize slow queries

### Frontend Optimization

1. Implement pagination in alert list
2. Use React.memo for list items
3. Debounce search/filter changes
4. Lazy load alert details

## Rollback Procedure

If deployment needs to be rolled back:

```bash
# Via Vercel CLI
vercel rollback

# Via Vercel Dashboard:
# 1. Go to Deployments
# 2. Find previous stable deployment
# 3. Click "Promote to Production"
```

### Database Rollback

```sql
-- If tables were corrupted, restore from backup
-- Via Supabase Dashboard: Database → Backups → Restore

-- Or manually restore using pg_dump
pg_restore -d postgres://... < backup.sql
```

## Incident Response

### Critical Alert Spike

1. Check webhook_logs for failures
2. Verify webhook secret hasn't changed
3. Check rate limiting hasn't been triggered
4. Review alert ingestion errors
5. Contact webhook senders to pause if needed

### Database Performance Degradation

1. Check current connections: `SELECT count(*) FROM pg_stat_activity;`
2. Run ANALYZE and VACUUM
3. Review slow query logs
4. Scale database if needed

### API Outage

1. Check Vercel deployment status
2. Verify database connectivity
3. Check environment variables
4. Review logs in Vercel dashboard
5. Restart function if needed

## Escalation

- **Development Team**: Code issues, feature requests
- **DevOps Team**: Infrastructure, scaling, database issues
- **Security Team**: HMAC validation, rate limiting, audit logs
- **On-call Engineer**: Critical incidents during business hours

## Documentation

- Implementation: `/vercel/share/v0-project/ALERTS_CENTER_GUIDE.md`
- This runbook: `/vercel/share/v0-project/RUNBOOK.md`
- API Schema: Inline in route handlers
- Database Schema: `scripts/002_create_tables.sql`
