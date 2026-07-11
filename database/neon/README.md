# Neon Database Setup

1. Open the Neon project SQL Editor.
2. Open `001_initial_schema.sql` from this directory.
3. Copy its full contents and run it once.

The script creates the Stream Pix application tables:

- `users`: profile linked to the Neon Auth user ID.
- `streamer_settings`: Pix key and overlay settings.
- `donations`: payment, media, status and history data.

Neon Auth manages credentials and sessions. The future Stream Pix backend will
create the matching `public.users` row after a successful authenticated login.
