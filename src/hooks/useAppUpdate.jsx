import { useEffect, useRef, useState } from 'react'
import { appVersion } from '../utils/appInfo.js'
import { checkForUpdate, installUpdate } from '../services/updater.js'
import { useNotifications } from '../contexts/NotificationContext.jsx'
import { useTranslation } from '../contexts/LanguageContext.jsx'
import { failureLabel } from '../utils/translations.js'

// Suit l'état de mise à jour ; la vérification de démarrage reste silencieuse et hors ligne n'échoue jamais bruyamment.
export default function useAppUpdate() {
  const { notify } = useNotifications()
  const { t } = useTranslation()
  const [update, setUpdate] = useState({ status: 'idle', release: null, error: null })
  const busy = useRef(false)
  const notifiedVersion = useRef(null)

  // Consulte les releases publiées du dépôt configuré.
  async function check({ silent = false } = {}) {
    if (busy.current) return update
    busy.current = true
    if (!silent) setUpdate((current) => ({ ...current, status: 'checking', error: null }))
    const result = await checkForUpdate(appVersion)
    busy.current = false
    const next = { status: result.status, release: result.release ?? null, error: result.code ?? null }
    setUpdate(next)
    if (next.status === 'available') {
      const version = next.release?.version ?? ''
      if (notifiedVersion.current !== version) {
        notifiedVersion.current = version
        notify({ type: 'update_available', title: t('update.status'), message: t('update.available', { version }), key: 'update', duration: 0 })
      }
    } else if (next.status === 'error' && !silent) {
      notify({ type: 'error', title: t('update.status'), message: t('update.error'), key: 'update', duration: 0 })
    }
    return next
  }

  // Lance l'installation après confirmation native ; l'application se ferme si le helper démarre.
  async function install(labels) {
    if (!update.release) return { ok: false, code: 'UPDATE_INVALID' }
    const result = await installUpdate(update.release, labels)
    if (!result.ok && result.code !== 'UPDATE_CANCELLED') {
      notify({ type: 'error', title: t('update.status'), message: failureLabel(result, t), key: 'update', duration: 0 })
      setUpdate((current) => ({ ...current, status: 'error', error: result.code }))
    }
    return result
  }

  useEffect(() => { check({ silent: true }) }, [])

  return { update, check, install }
}
