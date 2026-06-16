-- Clear fake preview_url values seeded with fabricated GCS file IDs that 404.
-- Real URLs will populate when voice-sync runs with a valid ELEVENLABS_API_KEY.
UPDATE voice_catalog
SET preview_url = NULL
WHERE preview_url LIKE 'https://storage.googleapis.com/eleven-public-prod/%';