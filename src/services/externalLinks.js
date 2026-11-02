let clientPromise

// N'ouvre qu'une URL web explicite : jamais un schéma local, un fichier ou un chemin arbitraire.
function isExternalWebUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url)
}

// Initialise le client natif local au premier accès, comme les autres services desktop.
async function getClient() {
  if (typeof window === 'undefined' || typeof window.NL_TOKEN !== 'string' || !window.NL_PORT) return null
  if (!clientPromise) {
    clientPromise = import('@neutralinojs/lib').then((client) => { client.init(); return client })
  }
  return clientPromise
}

// Ouvre un lien dans le navigateur système : capacité native en desktop, repli web dans le navigateur courant.
export async function openExternal(url) {
  if (!isExternalWebUrl(url)) return
  try {
    const client = await getClient()
    if (client) { await client.os.open(url); return }
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer')
  } catch {
    // Un échec d'ouverture native ne doit jamais casser l'interface ; on ne relance pas d'action distante.
  }
}
