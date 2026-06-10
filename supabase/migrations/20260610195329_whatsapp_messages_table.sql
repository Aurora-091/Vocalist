-- WhatsApp messages table for bidirectional messaging history
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text NOT NULL,
  message_sid text,
  status text DEFAULT 'sent',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_select_own" ON whatsapp_messages FOR SELECT
  TO authenticated USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);
CREATE POLICY "wa_insert_own" ON whatsapp_messages FOR INSERT
  TO authenticated WITH CHECK (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);
CREATE POLICY "wa_update_own" ON whatsapp_messages FOR UPDATE
  TO authenticated USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);
CREATE POLICY "wa_delete_own" ON whatsapp_messages FOR DELETE
  TO authenticated USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);

CREATE INDEX idx_wa_messages_org ON whatsapp_messages(org_id);
CREATE INDEX idx_wa_messages_from ON whatsapp_messages(from_number);
CREATE INDEX idx_wa_messages_created ON whatsapp_messages(created_at DESC);
