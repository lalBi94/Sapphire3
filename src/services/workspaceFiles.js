let clientPromise
const maximumFileSize = 20 * 1024 * 1024

// Initialise uniquement le client natif local, au premier accès depuis la fenêtre desktop.
async function getClient() {
  if (typeof window.NL_TOKEN !== 'string' || !window.NL_PORT) throw new Error('File dialogs are available in the Sapphire desktop app. Open the desktop app to import or export.')
  if (!clientPromise) {
    clientPromise = import('@neutralinojs/lib').then((client) => {
      client.init()
      return client
    })
  }
  return clientPromise
}

// Enregistre un texte au chemin choisi, avec extension garantie et confirmation d'écrasement.
export async function exportWorkspaceFile(extension, text) {
  if (!['sp3', 'json'].includes(extension)) throw new Error('Unsupported export format.')
  if (new TextEncoder().encode(text).length > maximumFileSize) throw new Error('The workspace is larger than the supported 20 MB file size.')
  const { os, filesystem } = await getClient()
  let path = await os.showSaveDialog('Export workspace', { defaultPath: `workspace.${extension}`, filters: [{ name: extension === 'sp3' ? 'Sapphire 3 workspace' : 'JSON workspace', extensions: [extension] }] })
  if (!path) return null
  if (!path.toLowerCase().endsWith(`.${extension}`)) path += `.${extension}`
  let exists = false
  try {
    const info = await filesystem.getStats(path)
    if (info.isDirectory) throw new Error('Please choose a file, not a folder.')
    exists = true
  } catch (error) {
    if (error.code !== 'NE_FS_NOPATHE') throw error
  }
  if (exists && await os.showMessageBox('Replace file?', 'The selected file already exists. Replace it?', 'YES_NO', 'WARNING') !== 'YES') return null
  await filesystem.writeFile(path, text)
  return path
}

// Ne lit que le fichier .sp3 ou .json choisi ; une annulation ne modifie pas le document.
export async function importWorkspaceFile() {
  const { os, filesystem } = await getClient()
  const paths = await os.showOpenDialog('Import workspace', { multiSelections: false, filters: [{ name: 'Sapphire 3 / JSON', extensions: ['sp3', 'json'] }] })
  if (!paths.length) return null
  const path = paths[0]
  if (!/\.(sp3|json)$/i.test(path)) throw new Error('Please choose a .sp3 or .json file.')
  const info = await filesystem.getStats(path)
  if (!info.isFile || info.size > maximumFileSize) throw new Error('Please choose a workspace file smaller than 20 MB.')
  return { path, text: await filesystem.readFile(path) }
}
