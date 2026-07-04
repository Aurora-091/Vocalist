-- ============================================================
-- ITEM 3: Auth/Public User Row Consistency Check
-- Tests the test account used 13:54-14:24 UTC today.
--
-- Run this in Supabase SQL Editor (service_role / superuser).
-- Replace the email below with the actual test account email.
-- ============================================================

-- Step 1: Check auth.users row
SELECT
  id,
  email,
  email_confirmed_at,
  created_at,
  app_metadata->>'org_id'  AS org_id_in_metadata,
  app_metadata->>'role'    AS role_in_metadata,
  raw_user_meta_data
FROM auth.users
WHERE email = 'YOUR_TEST_EMAIL_HERE'
   OR email LIKE '%test%'  -- widen if email unknown
ORDER BY created_at DESC
LIMIT 5;

-- Step 2: Check public.users row and whether IDs match
SELECT
  u.id             AS public_user_id,
  u.email,
  u.org_id,
  u.role,
  u.created_at,
  au.id            AS auth_user_id,
  CASE WHEN au.id IS NULL THEN 'MISSING IN AUTH.USERS'
       WHEN au.id = u.id  THEN 'OK - IDs match'
       ELSE 'MISMATCH'
  END              AS consistency_status,
  o.name           AS org_name,
  o.plan_id
FROM public.users u
LEFT JOIN auth.users au ON au.id = u.id
LEFT JOIN orgs o ON o.id = u.org_id
WHERE u.email = 'YOUR_TEST_EMAIL_HERE'
   OR u.email LIKE '%test%'
ORDER BY u.created_at DESC
LIMIT 5;

-- Step 3: Check for orphaned auth.users rows (auth exists, public.users doesn't)
SELECT
  au.id,
  au.email,
  au.created_at,
  'ORPHANED - no public.users row' AS status
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
  AND (au.email = 'YOUR_TEST_EMAIL_HERE' OR au.email LIKE '%test%')
ORDER BY au.created_at DESC
LIMIT 5;
