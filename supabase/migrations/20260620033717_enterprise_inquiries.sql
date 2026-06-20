-- Enterprise inquiry submissions from the landing page dialog
CREATE TABLE IF NOT EXISTS enterprise_inquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text NOT NULL,
  business_type   text,
  call_volume     text,
  pain_point      text,
  timeline        text,
  extra_info      text,
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_inquiries_email_idx     ON enterprise_inquiries (email);
CREATE INDEX IF NOT EXISTS enterprise_inquiries_status_idx    ON enterprise_inquiries (status);
CREATE INDEX IF NOT EXISTS enterprise_inquiries_created_at_idx ON enterprise_inquiries (created_at DESC);

ALTER TABLE enterprise_inquiries ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read / manage — public inserts go via the backend service role key
CREATE POLICY "admin_select_enterprise_inquiries" ON enterprise_inquiries
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
        AND public.users.platform_role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "admin_update_enterprise_inquiries" ON enterprise_inquiries
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
        AND public.users.platform_role IN ('super_admin', 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
        AND public.users.platform_role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "admin_delete_enterprise_inquiries" ON enterprise_inquiries
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
        AND public.users.platform_role IN ('super_admin', 'admin')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_enterprise_inquiries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER enterprise_inquiries_updated_at
  BEFORE UPDATE ON enterprise_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_enterprise_inquiries_updated_at();
