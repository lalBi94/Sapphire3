// Reconnaît une image intégrée au document sous forme de data URL.
export function isEmbeddedImage(value) {
  return typeof value === 'string' && (value === '' || /^data:image\/(?:png|jpeg|gif|webp|bmp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/=\s]+$/.test(value))
}

// Reconnaît une référence relative à une image du dossier `images/` du workspace.
// Aucun chemin absolu, aucune remontée de dossier et aucune URL distante ne sont acceptés.
export function isImageReference(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 255
    && !value.includes('..')
    && /^images\/[^/\\:*?"<>|\u0000-\u001f]+\.(?:png|jpe?g|gif|webp|bmp|avif|svg|ico)$/i.test(value)
}

// Extrait le nom de fichier d'une référence d'image validée.
export function imageReferenceName(reference) {
  return String(reference).slice('images/'.length)
}

// Associe une extension d'image à son type MIME, pour reconstruire un affichage local.
export function imageMimeType(name) {
  const extension = String(name).split('.').pop()?.toLowerCase() ?? ''
  const types = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    bmp: 'image/bmp', avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon',
  }
  return types[extension] ?? 'application/octet-stream'
}

// Associe un type MIME à l'extension utilisée dans le dossier `images/`.
export function imageExtension(mimeType) {
  const extensions = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/bmp': 'bmp', 'image/avif': 'avif', 'image/svg+xml': 'svg',
    'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico',
  }
  return extensions[String(mimeType).toLowerCase()] ?? 'png'
}

// Convertit des octets binaires en data URL, par blocs pour éviter une chaîne trop longue.
export function bytesToDataUrl(bytes, mimeType) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < view.length; index += chunk) {
    binary += String.fromCharCode(...view.subarray(index, index + chunk))
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}

// Relit les octets d'une image intégrée ; une data URL invalide est refusée.
export function dataUrlToBytes(dataUrl) {
  const match = /^data:[^;,]+;base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl))
  if (!match) return null
  try {
    const binary = atob(match[1].replace(/\s+/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return bytes
  } catch {
    return null
  }
}

// Extrait le type MIME d'une data URL d'image.
export function dataUrlMimeType(dataUrl) {
  const match = /^data:([^;,]+);base64,/.exec(String(dataUrl))
  return match ? match[1] : 'image/png'
}
