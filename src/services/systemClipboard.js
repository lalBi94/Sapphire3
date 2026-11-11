// Accès au presse-papiers système.
// En desktop, le chemin passe par l'API native Neutralinojs, implémentée dans le cœur C++ ;
// `navigator.clipboard` ne sert qu'au mode web de développement, jamais à la fenêtre native.

let clientPromise = null

// Reconnaît la fenêtre desktop ; le mode Vite/web ne charge pas le client natif.
function desktopAvailable() {
  return typeof window !== 'undefined' && typeof window.NL_TOKEN === 'string' && Boolean(window.NL_PORT)
}

// Charge le client Neutralinojs une seule fois.
async function getClient() {
  if (!desktopAvailable()) return null
  if (!clientPromise) {
    clientPromise = import('@neutralinojs/lib')
      .then((client) => {
        client.init()
        return client
      })
      .catch(() => null)
  }
  return clientPromise
}

// Lit le texte du presse-papiers système, ou null si le support est absent.
export async function readSystemClipboard() {
  const client = await getClient()
  try {
    if (client?.clipboard?.readText) return await client.clipboard.readText()
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) return await navigator.clipboard.readText()
  } catch {
    return null
  }
  return null
}

// Écrit un texte dans le presse-papiers système.
export async function writeSystemClipboard(text) {
  const client = await getClient()
  try {
    if (client?.clipboard?.writeText) {
      await client.clipboard.writeText(String(text))
      return true
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(String(text))
      return true
    }
  } catch {
    return false
  }
  return false
}

// Vide le presse-papiers système lorsque l'API native le permet.
export async function clearSystemClipboard() {
  const client = await getClient()
  try {
    if (client?.clipboard?.clear) {
      await client.clipboard.clear()
      return true
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText('')
      return true
    }
  } catch {
    return false
  }
  return false
}
