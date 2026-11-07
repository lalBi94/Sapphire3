import { assetMatchesTarget, normalizeUpdateTarget, pickUpdate } from '../utils/updateCheck.js'

const releasesUrl = 'https://api.github.com/repos/lalBi94/Sapphire3/releases?per_page=20'
const repositoryPrefix = '/lalBi94/Sapphire3/releases/download/'
let clientPromise

// Initialise le client natif local au premier accès, comme les autres services desktop.
async function getClient() {
  if (typeof window === 'undefined' || typeof window.NL_TOKEN !== 'string' || !window.NL_PORT) return null
  if (!clientPromise) {
    clientPromise = import('@neutralinojs/lib').then((client) => { client.init(); return client })
  }
  return clientPromise
}

// Lit la plateforme et l'architecture réellement injectées par Neutralinojs.
function updateTarget() {
  if (typeof window === 'undefined') return null
  return normalizeUpdateTarget(window.NL_OS, window.NL_ARCH)
}

// N'accepte que l'asset HTTPS du dépôt configuré et un digest SHA-256 vérifiable.
function validAsset(asset) {
  if (!asset || typeof asset.url !== 'string') return false
  let parsed
  try { parsed = new URL(asset.url) } catch { return false }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || !parsed.pathname.startsWith(repositoryPrefix)) return false
  return /^[0-9a-f]{64}$/.test(asset.digest) && Number.isSafeInteger(asset.size) && asset.size > 0
}

// Vérifie que la release correspond bien à la plateforme et à l'architecture choisies.
function validRelease(release) {
  if (!release || !release.platform || !release.arch) return false
  return assetMatchesTarget(release.asset?.name, release.platform, release.arch) && validAsset(release.asset)
}

// Entoure une valeur de guillemets doubles pour la ligne de commande PowerShell.
function quote(value) {
  return `"${String(value).replace(/"/g, '')}"`
}

// Consulte les releases publiées du dépôt configuré et retourne l'état de mise à jour.
export async function checkForUpdate(currentVersion) {
  const client = await getClient()
  if (!client) return { status: 'unavailable' }
  const target = updateTarget()
  if (!target) return { status: 'unsupported' }
  try {
    const response = await client.net.request(releasesUrl, 'GET', {
      headers: [{ 'User-Agent': 'Sapphire3', Accept: 'application/vnd.github+json' }],
      encodePath: true,
      keepAlive: false,
    })
    if (response?.status !== 200) return { status: 'error', code: 'UPDATE_CHECK_FAILED' }
    const release = pickUpdate(JSON.parse(response.body), currentVersion, target)
    return release ? { status: 'available', release } : { status: 'none' }
  } catch {
    return { status: 'error', code: 'UPDATE_CHECK_FAILED' }
  }
}

// Windows : confirmation puis helper PowerShell. Linux/macOS : téléchargement manuel de l'asset vérifié.
export async function installUpdate(release, labels = {}) {
  const client = await getClient()
  if (!client) return { ok: false, code: 'UPDATE_DESKTOP_REQUIRED' }
  if (!validRelease(release)) return { ok: false, code: 'UPDATE_INVALID' }

  if (release.installMode === 'manual' || release.platform !== 'windows') {
    if (typeof client.os.open !== 'function') return { ok: false, code: 'UPDATE_DOWNLOAD_FAILED' }
    try {
      await client.os.open(release.asset.url)
      return { ok: true, mode: 'manual' }
    } catch {
      return { ok: false, code: 'UPDATE_DOWNLOAD_FAILED' }
    }
  }

  const installDir = typeof window.NL_PATH === 'string' ? window.NL_PATH.replace(/[\\/]+$/, '') : ''
  if (!installDir || installDir.includes('"')) return { ok: false, code: 'UPDATE_INVALID' }
  const helper = `${installDir}\\updater.ps1`
  try {
    const stats = await client.filesystem.getStats(helper)
    if (!stats?.isFile) return { ok: false, code: 'UPDATE_HELPER_MISSING' }
  } catch {
    return { ok: false, code: 'UPDATE_HELPER_MISSING' }
  }
  if (typeof client.os.showMessageBox === 'function') {
    const choice = await client.os.showMessageBox(labels.title ?? 'Sapphire 3', labels.body ?? '', 'YES_NO', 'QUESTION')
    if (choice !== 'YES') return { ok: false, code: 'UPDATE_CANCELLED' }
  }
  const pid = Number(window.NL_PID)
  const command = [
    'powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', quote(helper),
    '-ZipUrl', quote(release.asset.url),
    '-ExpectedSha256', quote(release.asset.digest),
    '-ExpectedSize', String(release.asset.size),
    '-InstallDir', quote(installDir),
    '-WaitPid', String(Number.isFinite(pid) && pid > 0 ? pid : 0),
    '-ExeName', quote('Sapphire3.exe'),
  ].join(' ')
  try {
    await client.os.spawnProcess(command, { cwd: installDir })
  } catch {
    return { ok: false, code: 'UPDATE_SPAWN_FAILED' }
  }
  await client.app.exit()
  return { ok: true, mode: 'auto' }
}
