let clientPromise

// Initialise le client natif local au premier accès, comme les autres services desktop.
async function getClient() {
  if (typeof window === 'undefined' || typeof window.NL_TOKEN !== 'string' || !window.NL_PORT) return null
  if (!clientPromise) {
    clientPromise = import('@neutralinojs/lib').then((client) => { client.init(); return client })
  }
  return clientPromise
}

// Ferme l'application : capacité native en desktop, fermeture de l'onglet en repli web.
export async function quitApplication() {
  try {
    const client = await getClient()
    if (client) { await client.app.exit(); return true }
    if (typeof window !== 'undefined') window.close()
    return true
  } catch {
    return false
  }
}

// Bascule la fenêtre en plein écran (natif) ou l'onglet (repli web) et retourne le nouvel état.
export async function toggleFullScreen() {
  try {
    const client = await getClient()
    if (client) {
      const fullScreen = await client.window.isFullScreen()
      if (fullScreen) await client.window.exitFullScreen()
      else await client.window.setFullScreen()
      return !fullScreen
    }
    if (typeof document !== 'undefined') {
      if (document.fullscreenElement) { await document.exitFullscreen(); return false }
      if (document.documentElement.requestFullscreen) { await document.documentElement.requestFullscreen(); return true }
    }
  } catch {
    // Un échec de bascule ne doit pas casser l'interface.
  }
  return false
}
