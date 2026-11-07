// Logique pure de la Rich Presence Discord : aucune API native, aucun état global.
export const discordApplicationId = '1568755585250492416'
export const discordRepositoryUrl = 'https://github.com/lalBi94/Sapphire3'
export const discordReleasesUrl = 'https://github.com/lalBi94/Sapphire3/releases'
export const discordPreferenceKey = 'sapphire-discord-presence'

// Clés à importer une seule fois dans le Discord Developer Portal (Rich Presence → Art Assets).
export const discordAssets = Object.freeze({
  large: 'sapphire3_logo',
  small: 'sapphire3_activity',
})

const modeDetails = Object.freeze({
  ready: 'Exploring visual programming',
  editing: 'Building a visual program',
  simulation: 'Running a simulation',
  debug: 'Debugging a program',
  transpile: 'Transpiling',
  exercise: 'Working on an exercise',
})

const modeSmallText = Object.freeze({
  ready: 'Ready',
  editing: 'Editing',
  simulation: 'Simulation',
  debug: 'Debug',
  transpile: 'Transpilation',
  exercise: 'Exercise',
})

// Seule la valeur explicite « false » désactive la présence ; l'absence garde Enabled par défaut.
export function parseDiscordPresencePreference(value) {
  return value !== 'false'
}

// Traduit la cible de transpilation en libellé court, sans exposer de fichier ni de source.
export function discordTargetLabel(target) {
  if (target === 'javascript') return 'JavaScript'
  if (target === 'python') return 'Python'
  return 'code'
}

// Construit une activité générique : compteurs seulement, jamais de nom de fichier, de module ou de variable.
export function buildDiscordActivity({ mode = 'ready', modules = 0, nodes = 0, target = null, running = false, paused = false, stopped = false } = {}) {
  const safeMode = Object.prototype.hasOwnProperty.call(modeDetails, mode) ? mode : 'ready'
  const moduleCount = Number.isSafeInteger(modules) ? Math.max(0, modules) : 0
  const nodeCount = Number.isSafeInteger(nodes) ? Math.max(0, nodes) : 0
  let details = modeDetails[safeMode]
  let state = ''
  if (safeMode === 'ready') state = 'Ready to create'
  if (safeMode === 'editing') state = `${moduleCount} modules · ${nodeCount} nodes`
  if (safeMode === 'simulation') state = running ? 'Executing program' : paused ? 'Simulation paused' : stopped ? 'Simulation stopped' : 'Executing program'
  if (safeMode === 'debug') state = 'Execution paused'
  if (safeMode === 'transpile') {
    details = `Transpiling to ${discordTargetLabel(target)}`
    state = 'Generating code'
  }
  if (safeMode === 'exercise') state = 'Visual programming'
  return {
    details,
    state,
    assets: {
      large_image: discordAssets.large,
      large_text: 'Sapphire 3',
      small_image: discordAssets.small,
      small_text: modeSmallText[safeMode],
    },
    buttons: [
      { label: 'View on GitHub', url: discordRepositoryUrl },
      { label: 'Download Sapphire 3', url: discordReleasesUrl },
    ],
  }
}

// Signature stable : une mise à jour identique n'est jamais renvoyée à Discord.
export function discordActivityKey(activity) {
  return JSON.stringify({
    details: activity?.details ?? '',
    state: activity?.state ?? '',
    large: activity?.assets?.large_image ?? '',
    small: activity?.assets?.small_image ?? '',
    buttons: activity?.buttons ?? [],
  })
}

// Backoff exponentiel borné, sans polling agressif.
export function nextDiscordRetryDelay(attempt) {
  const safeAttempt = Number.isSafeInteger(attempt) ? Math.max(0, Math.min(attempt, 6)) : 0
  return Math.min(60000, 1000 * 2 ** safeAttempt)
}

// Normalise les valeurs injectées par Neutralinojs.
function normalizedPlatform(platform) {
  const value = String(platform ?? '').toLowerCase()
  if (['windows', 'win32', 'win'].includes(value)) return 'win32'
  if (['linux'].includes(value)) return 'linux'
  if (['darwin', 'macos', 'mac'].includes(value)) return 'darwin'
  return ''
}

function normalizedArch(arch) {
  const value = String(arch ?? '').toLowerCase()
  if (['x64', 'amd64', 'x86_64'].includes(value)) return 'x64'
  if (['arm64', 'aarch64'].includes(value)) return 'arm64'
  if (['ia32', 'x86'].includes(value)) return 'x86'
  if (['arm'].includes(value)) return 'arm'
  return ''
}

// Liste les chemins possibles du sidecar, production puis développement, sans lancer de processus.
export function discordPresencePaths(platform, arch, basePath) {
  const target = normalizedPlatform(platform)
  const architecture = normalizedArch(arch)
  if (!target || !architecture || typeof basePath !== 'string' || basePath.trim() === '') return []
  if (target === 'win32' && architecture !== 'x64') return []
  if (target === 'linux' && !['x64', 'arm64'].includes(architecture)) return []
  if (target === 'darwin' && !['x64', 'arm64'].includes(architecture)) return []
  const base = basePath.replace(/[\\/]+$/, '')
  const name = target === 'win32'
    ? 'discord-presence.exe'
    : target === 'darwin' ? `discord-presence-${architecture}` : 'discord-presence'
  const production = target === 'win32' ? `${base}\\${name}` : `${base}/${name}`
  const development = target === 'win32'
    ? `${base}\\build\\presence\\windows-x64\\discord-presence.exe`
    : target === 'darwin'
      ? `${base}/build/presence/macos-${architecture}/discord-presence`
      : `${base}/build/presence/linux-${architecture}/discord-presence`
  return [...new Set([production, development])]
}

// Construit la ligne de commande Neutralinojs pour un sidecar déjà vérifié sur le disque.
export function discordPresenceCommand(binaryPath, pid) {
  if (typeof binaryPath !== 'string' || binaryPath.trim() === '') return null
  const safePid = Number.isSafeInteger(pid) && pid > 0 ? pid : 0
  return `"${binaryPath.replace(/"/g, '')}" ${safePid}`
}
