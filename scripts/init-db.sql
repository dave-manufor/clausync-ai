-- Clausync.ai Database Schema
-- PostgreSQL 16 with pgvector extension

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. Organizations (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    stripe_customer_id TEXT,
    home_region TEXT DEFAULT 'us-central1',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    identity_provider_uid TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Monitored Resources (The Singleton)
CREATE TABLE monitored_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url_normalized TEXT NOT NULL,
    selector TEXT DEFAULT 'body',
    current_hash TEXT,
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(url_normalized, selector)
);

-- 4. Subscriptions (User <-> Resource Many-to-Many)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES monitored_resources(id) ON DELETE CASCADE,
    personalization_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, resource_id)
);

-- 5. Resource Snapshots (The History/WORM)
CREATE TABLE resource_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id UUID REFERENCES monitored_resources(id) ON DELETE CASCADE,
    gcs_uri TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Change Events (The Intelligence)
CREATE TABLE change_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id UUID REFERENCES monitored_resources(id) ON DELETE CASCADE,
    old_snapshot_id UUID REFERENCES resource_snapshots(id),
    new_snapshot_id UUID REFERENCES resource_snapshots(id),
    diff_json JSONB,
    global_ai_summary TEXT,
    global_risk_score INT CHECK (global_risk_score BETWEEN 1 AND 10),
    risk_keywords TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. User Context Embeddings (The RAG)
CREATE TABLE user_context_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source_filename TEXT,
    content_chunk TEXT NOT NULL,
    embedding VECTOR(768),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Notifications (Alerts)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    change_event_id UUID REFERENCES change_events(id) ON DELETE SET NULL,
    personalized_summary TEXT,
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Audit Logs (SOC 2 Compliance)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_resource ON subscriptions(resource_id);
CREATE INDEX idx_snapshots_resource ON resource_snapshots(resource_id);
CREATE INDEX idx_change_events_resource ON change_events(resource_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Vector index for RAG similarity search
CREATE INDEX idx_embeddings_vector ON user_context_embeddings USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monitored_resources_updated_at BEFORE UPDATE ON monitored_resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) for tenant isolation
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context_embeddings ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies require setting app.current_user_id before queries
-- Example policy (to be applied per-table):
-- CREATE POLICY user_isolation ON notifications FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);
