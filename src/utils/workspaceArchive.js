// Construit une archive ZIP « store » (sans compression) pour exporter un workspace complet.
// Le format est volontairement minimal : en-têtes locaux, répertoire central et fin de répertoire,
// avec des noms UTF-8. Aucune dépendance externe n'est nécessaire.

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

// Calcule le CRC32 d'un tableau d'octets, exigé par chaque entrée ZIP.
function crc32(bytes) {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

// Date DOS fixe : un export reproductible ne dépend pas du moment de la génération.
const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1
const dosTime = 0

// Normalise le nom d'une entrée : séparateurs Unix, sans racine ni remontée de dossier.
function entryName(name) {
  return String(name).replace(/\\/g, '/').replace(/^\/+/, '').replace(/(^|\/)\.\.(?=\/|$)/g, '')
}

// Écrit une archive ZIP contenant les entrées `{ name, data }`, où `data` est binaire.
export function buildWorkspaceZip(entries) {
  const prepared = entries.map((entry) => {
    const name = entryName(entry.name)
    const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data)
    return { nameBytes: new TextEncoder().encode(name), data, crc: crc32(data) }
  })
  const parts = []
  const central = []
  let offset = 0
  for (const entry of prepared) {
    const header = new Uint8Array(30 + entry.nameBytes.length)
    const view = new DataView(header.buffer)
    view.setUint32(0, 0x04034b50, true)
    view.setUint16(4, 20, true)
    view.setUint16(6, 0x0800, true)
    view.setUint16(8, 0, true)
    view.setUint16(10, dosTime, true)
    view.setUint16(12, dosDate, true)
    view.setUint32(14, entry.crc, true)
    view.setUint32(18, entry.data.length, true)
    view.setUint32(22, entry.data.length, true)
    view.setUint16(26, entry.nameBytes.length, true)
    view.setUint16(28, 0, true)
    header.set(entry.nameBytes, 30)
    parts.push(header, entry.data)

    const directory = new Uint8Array(46 + entry.nameBytes.length)
    const directoryView = new DataView(directory.buffer)
    directoryView.setUint32(0, 0x02014b50, true)
    directoryView.setUint16(4, 20, true)
    directoryView.setUint16(6, 20, true)
    directoryView.setUint16(8, 0x0800, true)
    directoryView.setUint16(10, 0, true)
    directoryView.setUint16(12, dosTime, true)
    directoryView.setUint16(14, dosDate, true)
    directoryView.setUint32(16, entry.crc, true)
    directoryView.setUint32(20, entry.data.length, true)
    directoryView.setUint32(24, entry.data.length, true)
    directoryView.setUint16(28, entry.nameBytes.length, true)
    directoryView.setUint16(30, 0, true)
    directoryView.setUint16(32, 0, true)
    directoryView.setUint16(34, 0, true)
    directoryView.setUint16(36, 0, true)
    directoryView.setUint32(38, 0, true)
    directoryView.setUint32(42, offset, true)
    directory.set(entry.nameBytes, 46)
    central.push(directory)
    offset += header.length + entry.data.length
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, prepared.length, true)
  endView.setUint16(10, prepared.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  endView.setUint16(20, 0, true)

  const zip = new Uint8Array(offset + centralSize + end.length)
  let cursor = 0
  for (const part of [...parts, ...central, end]) {
    zip.set(part, cursor)
    cursor += part.length
  }
  return zip
}

// Relit les entrées d'une archive ZIP « store » produite par l'application, pour les tests et un import futur.
export function readWorkspaceZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0
  const entries = []
  while (offset + 30 <= bytes.byteLength && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    if (method !== 0) throw new Error('Unsupported ZIP compression method.')
    const nameStart = offset + 30
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength))
    const dataStart = nameStart + nameLength + extraLength
    entries.push({ name, data: bytes.slice(dataStart, dataStart + compressedSize) })
    offset = dataStart + compressedSize
  }
  return entries
}
