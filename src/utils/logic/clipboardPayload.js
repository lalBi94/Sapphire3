export const clipboardMarker = 'sapphire3-clipboard'
export const clipboardPayloadVersion = 1

// Encode une capture de nœud ou de module dans un texte JSON portable.
export function encodeClipboardPayload(kind, payload) {
  if (!['node', 'module'].includes(kind) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  return JSON.stringify({ application: 'Sapphire 3', marker: clipboardMarker, version: clipboardPayloadVersion, kind, payload })
}

// Décode un texte de presse-papiers sans faire confiance à sa forme.
export function decodeClipboardPayload(text) {
  if (typeof text !== 'string' || text.trim() === '') return null
  try {
    const data = JSON.parse(text)
    if (!data || data.marker !== clipboardMarker || data.version !== clipboardPayloadVersion) return null
    if (!['node', 'module'].includes(data.kind)) return null
    if (!data.payload || typeof data.payload !== 'object' || Array.isArray(data.payload)) return null
    return { kind: data.kind, payload: data.payload }
  } catch {
    return null
  }
}
