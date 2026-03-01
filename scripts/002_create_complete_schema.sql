-- GitGov Dashboard Founder - Complete Schema
-- Version: 2.0
-- Created: 2026-03-01

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ORGANIZATIONS (TENANT)
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  webhook_secret VARCHAR(255) NOT NULL,
  rate_limit_per_minute INT DEFAULT 100,
  plan VARCHAR(50) DEFAULT 'free',
  health_status VARCHAR(20) DEFAULT 'healthy',
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CUSTOMERS (from GitGov)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  external_customer_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'free',
  mrr INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT 100,
  open_alerts_count INT DEFAULT 0,
  support_tickets_count INT DEFAULT 0,
  last_contact_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, external_customer_id)
);

-- ============================================
-- SUPPORT TICKETS
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_external_id VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  subject VARCHAR(500) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'open',
  channel VARCHAR(50) DEFAULT 'email',
  assigned_to VARCHAR(255),
  sla_deadline TIMESTAMP WITH TIME ZONE,
  first_response_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  tags JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, ticket_external_id)
);

-- ============================================
-- CHATBOT REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS chatbot_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255),
  user_email VARCHAR(255),
  question TEXT NOT NULL,
  answer TEXT,
  intent VARCHAR(255),
  confidence_score DECIMAL(5,2),
  was_supported BOOLEAN DEFAULT FALSE,
  was_escalated BOOLEAN DEFAULT FALSE,
  feedback VARCHAR(20),
  session_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INTEGRATIONS HEALTH
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  integration_name VARCHAR(100) NOT NULL,
  endpoint_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'unknown',
  last_check_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  last_error_message TEXT,
  error_count_24h INT DEFAULT 0,
  avg_latency_ms INT DEFAULT 0,
  uptime_percentage DECIMAL(5,2) DEFAULT 100.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, integration_name)
);

-- ============================================
-- ALERTS (existing - enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL,
  source_type VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  tags JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  snoozed_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- AUDIT ACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  actor VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50) DEFAULT 'founder',
  old_state JSONB,
  new_state JSONB,
  reason TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INTAKE LOGS (feature requests, support, etc)
-- ============================================
CREATE TABLE IF NOT EXISTS intake_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  intake_type VARCHAR(50) NOT NULL,
  external_id VARCHAR(255),
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  idempotency_key VARCHAR(255),
  error_message TEXT,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- WEBHOOK LOGS (existing - enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  webhook_type VARCHAR(50) NOT NULL,
  source VARCHAR(50),
  payload JSONB NOT NULL,
  status_code INT,
  error_message TEXT,
  idempotency_key VARCHAR(255),
  request_id VARCHAR(255),
  processing_time_ms INT,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- METRICS (for observability)
-- ============================================
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(20,4),
  metric_type VARCHAR(20) DEFAULT 'counter',
  tags JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================
-- Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_org_id ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_health ON customers(health_score);

-- Support Tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_id ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_sla ON support_tickets(sla_deadline);

-- Chatbot Requests
CREATE INDEX IF NOT EXISTS idx_chatbot_org_id ON chatbot_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_supported ON chatbot_requests(was_supported);
CREATE INDEX IF NOT EXISTS idx_chatbot_created ON chatbot_requests(created_at DESC);

-- Integrations Health
CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON integrations_health(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations_health(status);

-- Alerts
CREATE INDEX IF NOT EXISTS idx_alerts_org_id ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_source ON alerts(source);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

-- Audit Actions
CREATE INDEX IF NOT EXISTS idx_audit_org_id ON audit_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_alert_id ON audit_actions(alert_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_actions(actor);
CREATE INDEX IF NOT EXISTS idx_audit_request_id ON audit_actions(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_actions(created_at DESC);

-- Intake Logs
CREATE INDEX IF NOT EXISTS idx_intake_org_type ON intake_logs(organization_id, intake_type);
CREATE INDEX IF NOT EXISTS idx_intake_idempotency ON intake_logs(idempotency_key);

-- Webhook Logs
CREATE INDEX IF NOT EXISTS idx_webhook_org_id ON webhook_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_idempotency ON webhook_logs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_webhook_request_id ON webhook_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_webhook_created_at ON webhook_logs(created_at DESC);

-- Metrics
CREATE INDEX IF NOT EXISTS idx_metrics_org_name ON metrics(organization_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded_at ON metrics(recorded_at DESC);

-- ============================================
-- SEED DATA
-- ============================================
INSERT INTO organizations (name, slug, webhook_secret, plan) VALUES
  ('GitGov', 'gitgov', 'gitgov_webhook_secret_2026', 'enterprise'),
  ('Acme Corp', 'acme-corp', 'acme_webhook_secret_123', 'pro')
ON CONFLICT (slug) DO NOTHING;
