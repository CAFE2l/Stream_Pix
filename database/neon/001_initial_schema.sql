-- Stream Pix - Neon/Postgres initial schema
-- Run this entire file once in the Neon SQL Editor.
-- Firebase Auth owns user authentication; this backend owns all database access.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.streamer_settings (
  user_id text PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  pix_key text NOT NULL DEFAULT '',
  alert_text text NOT NULL DEFAULT 'Obrigado pela doação!',
  primary_color text NOT NULL DEFAULT '#00FF88',
  duration_seconds integer NOT NULL DEFAULT 5 CHECK (duration_seconds BETWEEN 1 AND 30),
  overlay_enabled boolean NOT NULL DEFAULT true,
  theme text NOT NULL DEFAULT 'neon' CHECK (theme IN ('neon', 'minimal', 'gamer', 'cyberpunk', 'clean')),
  sound_enabled boolean NOT NULL DEFAULT true,
  gif_enabled boolean NOT NULL DEFAULT true,
  overlay_position text NOT NULL DEFAULT 'bottom-center'
    CHECK (overlay_position IN ('bottom-center', 'top-center', 'bottom-left', 'bottom-right', 'top-left', 'top-right')),
  font_size text NOT NULL DEFAULT 'md' CHECK (font_size IN ('sm', 'md', 'lg')),
  card_size text NOT NULL DEFAULT 'normal' CHECK (card_size IN ('compact', 'normal', 'large')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  donor_name text NOT NULL DEFAULT 'Anônimo',
  amount numeric(12, 2) NOT NULL CHECK (amount > 0 AND amount <= 10000),
  donation_type text NOT NULL CHECK (donation_type IN ('text', 'audio', 'video')),
  message text NOT NULL DEFAULT '',
  audio_url text,
  video_url text,
  cloudinary_public_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'expired', 'failed', 'played')),
  is_test boolean NOT NULL DEFAULT false,
  displayed boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'mock',
  provider_payment_id text,
  provider_status text,
  txid text UNIQUE,
  pix_copia_e_cola text,
  qr_code text,
  end_to_end_id text,
  crypto_transaction_id text,
  failure_reason text,
  paid_at timestamptz,
  played_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS donations_streamer_created_at_idx
  ON public.donations (streamer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS donations_overlay_queue_idx
  ON public.donations (streamer_id, created_at ASC)
  WHERE status = 'paid' AND displayed = false;

CREATE INDEX IF NOT EXISTS donations_pending_idx
  ON public.donations (streamer_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS donations_txid_idx
  ON public.donations (txid)
  WHERE txid IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS streamer_settings_set_updated_at ON public.streamer_settings;
CREATE TRIGGER streamer_settings_set_updated_at
BEFORE UPDATE ON public.streamer_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS donations_set_updated_at ON public.donations;
CREATE TRIGGER donations_set_updated_at
BEFORE UPDATE ON public.donations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Firebase Auth owns user authentication. The backend will create/upsert the
-- matching row in public.users after each authenticated login.
