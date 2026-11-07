import { useEffect, useState } from 'react'
import { hydratePreferences } from '../services/preferences.js'
import { readDiscordPresenceEnabled, setDiscordPresenceEnabled, startDiscordPresence, stopDiscordPresence, updateDiscordPresence } from '../services/discordPresence.js'

// Démarre le sidecar Discord une seule fois par instance et publie l'activité fournie.
export default function useDiscordPresence(activity) {
  const [enabled, setEnabledState] = useState(() => readDiscordPresenceEnabled())
  const [hydrated, setHydrated] = useState(false)

  // Relit la préférence durable avant de lancer quoi que ce soit, pour respecter un « Disabled » enregistré.
  useEffect(() => {
    let active = true
    hydratePreferences().then(() => {
      if (!active) return
      setEnabledState(readDiscordPresenceEnabled())
      setHydrated(true)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!hydrated) return undefined
    if (enabled) startDiscordPresence()
    else stopDiscordPresence({ immediate: true })
    return () => {
      if (enabled) stopDiscordPresence()
    }
  }, [enabled, hydrated])

  useEffect(() => {
    if (hydrated && enabled && activity) updateDiscordPresence(activity)
  }, [enabled, hydrated, activity])

  // Applique le choix immédiatement et le conserve dans les préférences.
  function setEnabled(next) {
    setEnabledState(Boolean(next))
    setDiscordPresenceEnabled(Boolean(next))
  }

  return { enabled, setEnabled }
}
