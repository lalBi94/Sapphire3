// Les préférences doivent survivre à la fermeture de la fenêtre : Neutralinojs storage est la copie durable,
// localStorage ne sert que de cache synchrone pour ne pas retarder le premier rendu de l'interface.
let storageClientPromise

// Retourne le client natif de stockage, ou null hors fenêtre desktop (développement web).
async function getStorageClient() {
  if (typeof window === 'undefined' || typeof window.NL_TOKEN !== 'string' || !window.NL_PORT) return null
  if (!storageClientPromise) {
    storageClientPromise = import('@neutralinojs/lib')
      .then((client) => {
        client.init()
        return client
      })
      .catch(() => {
        storageClientPromise = null
        return null
      })
  }
  return storageClientPromise
}

// Lit la valeur dans le cache local ; la copie durable est rechargée au démarrage par hydratePreferences.
export function readPreference(key) {
  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    console.warn('Interface preferences could not be read.', error)
    return null
  }
}

// Écrit le cache local immédiatement puis la copie durable native, sans bloquer l'interface.
export function writePreference(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch (error) {
    console.warn('Interface preferences could not be saved.', error)
  }
  getStorageClient()
    .then((client) => (client ? client.storage.setData(key, value) : null))
    .catch(() => console.warn('Durable preference storage is unavailable.'))
}

// Remplit le cache local depuis la copie durable ; les appels natifs sont mis en file d'attente par le
// client jusqu'à l'ouverture de la connexion, donc aucun délai manuel n'est nécessaire au démarrage.
export async function hydratePreferences() {
  const client = await getStorageClient()
  if (!client) return
  let storedKeys
  try {
    storedKeys = await client.storage.getKeys()
  } catch {
    return
  }
  const keys = Array.isArray(storedKeys) ? storedKeys : storedKeys?.keys ?? []
  for (const key of keys) {
    if (typeof key !== 'string') continue
    try {
      const value = await client.storage.getData(key)
      if (typeof value === 'string') window.localStorage.setItem(key, value)
    } catch {
      // Une clé illisible ne doit pas empêcher la lecture des autres préférences.
    }
  }
}
