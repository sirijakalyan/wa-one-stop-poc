-- Renewal notifications remember which business they belong to, so removing a business can remove them.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS biz TEXT;
