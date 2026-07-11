import { Router, Request, Response } from 'express'
import { query } from '../services/db.js'

const router = Router()

interface SettingsRow {
  user_id: string
  pix_key: string
  alert_text: string
  primary_color: string
  duration_seconds: number
  overlay_enabled: boolean
  theme: string
  sound_enabled: boolean
  gif_enabled: boolean
  overlay_position: string
  font_size: string
  card_size: string
}

function rowToSettings(row: SettingsRow) {
  return {
    streamerName: '',
    pixKey: row.pix_key,
    alertText: row.alert_text,
    primaryColor: row.primary_color,
    duration: row.duration_seconds,
    overlayEnabled: row.overlay_enabled,
    theme: row.theme,
    soundEnabled: row.sound_enabled,
    gifEnabled: row.gif_enabled,
    overlayPosition: row.overlay_position,
    fontSize: row.font_size,
    cardSize: row.card_size,
  }
}

router.get('/:uid', async (req: Request, res: Response) => {
  try {
    const { uid } = req.params

    const userResult = await query<{ display_name: string }>(
      'SELECT display_name FROM public.users WHERE id = $1',
      [uid]
    )

    const settingsResult = await query<SettingsRow>(
      'SELECT * FROM public.streamer_settings WHERE user_id = $1',
      [uid]
    )

    if (settingsResult.rows.length === 0) {
      await query(
        `INSERT INTO public.users (id, email, display_name)
         VALUES ($1, '', $2)
         ON CONFLICT (id) DO NOTHING`,
        [uid, '']
      )

      await query(
        `INSERT INTO public.streamer_settings (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [uid]
      )

      const fresh = await query<SettingsRow>(
        'SELECT * FROM public.streamer_settings WHERE user_id = $1',
        [uid]
      )

      return res.json({
        streamerName: userResult.rows[0]?.display_name || '',
        ...rowToSettings(fresh.rows[0]),
      })
    }

    return res.json({
      streamerName: userResult.rows[0]?.display_name || '',
      ...rowToSettings(settingsResult.rows[0]),
    })
  } catch (error) {
    console.error('[settings/get] Error:', error)
    return res.status(500).json({ error: 'Erro ao buscar configurações' })
  }
})

router.put('/:uid', async (req: Request, res: Response) => {
  try {
    const { uid } = req.params
    const {
      streamerName,
      pixKey,
      alertText,
      primaryColor,
      duration,
      overlayEnabled,
      theme,
      soundEnabled,
      gifEnabled,
      overlayPosition,
      fontSize,
      cardSize,
    } = req.body

    await query(
      `INSERT INTO public.users (id, email, display_name)
       VALUES ($1, '', $2)
       ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [uid, streamerName || '']
    )

    await query(
      `INSERT INTO public.streamer_settings (user_id, pix_key, alert_text, primary_color, duration_seconds, overlay_enabled, theme, sound_enabled, gif_enabled, overlay_position, font_size, card_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (user_id) DO UPDATE SET
         pix_key = EXCLUDED.pix_key,
         alert_text = EXCLUDED.alert_text,
         primary_color = EXCLUDED.primary_color,
         duration_seconds = EXCLUDED.duration_seconds,
         overlay_enabled = EXCLUDED.overlay_enabled,
         theme = EXCLUDED.theme,
         sound_enabled = EXCLUDED.sound_enabled,
         gif_enabled = EXCLUDED.gif_enabled,
         overlay_position = EXCLUDED.overlay_position,
         font_size = EXCLUDED.font_size,
         card_size = EXCLUDED.card_size`,
      [
        uid,
        pixKey || '',
        alertText || 'Obrigado pela doação!',
        primaryColor || '#00FF88',
        duration || 5,
        overlayEnabled ?? true,
        theme || 'neon',
        soundEnabled ?? true,
        gifEnabled ?? true,
        overlayPosition || 'bottom-center',
        fontSize || 'md',
        cardSize || 'normal',
      ]
    )

    return res.json({ ok: true })
  } catch (error) {
    console.error('[settings/put] Error:', error)
    return res.status(500).json({ error: 'Erro ao salvar configurações' })
  }
})

export default router
