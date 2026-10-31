import { translate } from '../utils/translations.js'

let clientPromise
const maximumFileSize = 20 * 1024 * 1024

// Transporte un code et ses paramètres sans lier les accès natifs à React ou à une langue globale.
function fileError(code, values = {}) {
  return Object.assign(new Error(code), { code, values })
}

// Initialise uniquement le client natif local, au premier accès depuis la fenêtre desktop.
async function getClient() {
  if (typeof window === 'undefined' || typeof window.NL_TOKEN !== 'string' || !window.NL_PORT) throw fileError('DESKTOP_REQUIRED')
  if (!clientPromise) {
    clientPromise = import('@neutralinojs/lib').then((client) => {
      client.init()
      return client
    })
  }
  return clientPromise
}

// Enregistre un texte au chemin choisi, avec extension garantie et confirmation d'écrasement.
export async function exportWorkspaceFile(extension, text, language = 'en') {
  if (!['sp3', 'json', 'js'].includes(extension)) throw fileError('EXPORT_FORMAT_INVALID')
  if (new TextEncoder().encode(text).length > maximumFileSize) throw fileError('FILE_TOO_LARGE')
  const { os, filesystem } = await getClient()
  const filterKey = extension === 'sp3' ? 'files.sp3Filter' : extension === 'json' ? 'files.jsonFilter' : 'files.jsFilter'
  let path = await os.showSaveDialog(translate(language, 'files.exportTitle'), { defaultPath: `workspace.${extension}`, filters: [{ name: translate(language, filterKey), extensions: [extension] }] })
  if (!path) return null
  if (!path.toLowerCase().endsWith(`.${extension}`)) path += `.${extension}`
  let exists = false
  try {
    const info = await filesystem.getStats(path)
    if (info.isDirectory) throw fileError('FILE_REQUIRED')
    exists = true
  } catch (error) {
    if (error.code !== 'NE_FS_NOPATHE') throw error
  }
  if (exists && await os.showMessageBox(translate(language, 'files.replaceTitle'), translate(language, 'files.replaceBody'), 'YES_NO', 'WARNING') !== 'YES') return null
  return writeWorkspaceFile(path, text, { filesystem, extension })
}

// Ecrit directement un workspace déjà associé à un chemin connu.
export async function writeWorkspaceFile(path, text, client = null) {
  const extension = client?.extension || 'sp3'
  if (typeof path !== 'string' || !path.toLowerCase().endsWith(`.${extension}`)) throw fileError('FILE_EXTENSION_INVALID', { extension })
  if (new TextEncoder().encode(text).length > maximumFileSize) throw fileError('FILE_TOO_LARGE')
  const { filesystem } = client || await getClient()
  await filesystem.writeFile(path, text)
  return path
}

// Ne lit que le fichier choisi avec les extensions autorisees ; une annulation ne modifie pas le document.
export async function importWorkspaceFile(extensions = ['sp3', 'json'], language = 'en') {
  const { os, filesystem } = await getClient()
  const filters = extensions.includes('json')
    ? [{ name: translate(language, 'files.combinedFilter'), extensions }]
    : [{ name: translate(language, 'files.sp3Filter'), extensions }]
  const paths = await os.showOpenDialog(translate(language, 'files.openTitle'), { multiSelections: false, filters })
  if (!paths.length) return null
  const path = paths[0]
  if (!new RegExp(`\\.(${extensions.join('|')})$`, 'i').test(path)) throw fileError('FILE_EXTENSION_INVALID', { extension: extensions[0] })
  const info = await filesystem.getStats(path)
  if (!info.isFile || info.size > maximumFileSize) throw fileError('FILE_INVALID')
  return { path, text: await filesystem.readFile(path) }
}

// Relit un fichier recent connu sans afficher un second dialogue de sélection.
export async function readWorkspaceFile(path, extension = 'sp3') {
  if (typeof path !== 'string' || !path.toLowerCase().endsWith(`.${extension}`)) throw fileError('FILE_EXTENSION_INVALID', { extension })
  const { filesystem } = await getClient()
  const info = await filesystem.getStats(path)
  if (!info.isFile || info.size > maximumFileSize) throw fileError('FILE_INVALID')
  return { path, text: await filesystem.readFile(path) }
}
