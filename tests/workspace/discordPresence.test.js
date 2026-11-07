import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDiscordActivity,
  discordActivityKey,
  discordApplicationId,
  discordPresenceCommand,
  discordPresencePaths,
  discordReleasesUrl,
  discordRepositoryUrl,
  nextDiscordRetryDelay,
  parseDiscordPresencePreference,
} from '../../src/utils/discordPresence.js'
import {
  __resetDiscordPresenceForTests,
  readDiscordPresenceEnabled,
  setDiscordPresenceEnabled,
  startDiscordPresence,
  stopDiscordPresence,
  updateDiscordPresence,
} from '../../src/services/discordPresence.js'

test('discord : l’identifiant et les boutons sont ceux de Sapphire 3', () => {
  assert.equal(discordApplicationId, '1568755585250492416')
  assert.equal(discordRepositoryUrl, 'https://github.com/lalBi94/Sapphire3')
  assert.equal(discordReleasesUrl, 'https://github.com/lalBi94/Sapphire3/releases')
  const activity = buildDiscordActivity()
  assert.deepEqual(activity.buttons, [
    { label: 'View on GitHub', url: discordRepositoryUrl },
    { label: 'Download Sapphire 3', url: discordReleasesUrl },
  ])
  assert.equal(activity.assets.large_image, 'sapphire3_logo')
  assert.equal(activity.assets.large_text, 'Sapphire 3')
  assert.equal(activity.assets.small_image, 'sapphire3_activity')
})

test('discord : les transitions d’activité restent génériques et sans donnée personnelle', () => {
  assert.deepEqual(
    (({ details, state }) => ({ details, state }))(buildDiscordActivity({ mode: 'ready' })),
    { details: 'Exploring visual programming', state: 'Ready to create' },
  )
  assert.deepEqual(
    (({ details, state }) => ({ details, state }))(buildDiscordActivity({ mode: 'editing', modules: 12, nodes: 84 })),
    { details: 'Building a visual program', state: '12 modules · 84 nodes' },
  )
  assert.equal(buildDiscordActivity({ mode: 'simulation', running: true }).state, 'Executing program')
  assert.equal(buildDiscordActivity({ mode: 'simulation', paused: true }).state, 'Simulation paused')
  assert.equal(buildDiscordActivity({ mode: 'simulation', stopped: true }).state, 'Simulation stopped')
  assert.equal(buildDiscordActivity({ mode: 'debug' }).state, 'Execution paused')
  assert.equal(buildDiscordActivity({ mode: 'transpile', target: 'javascript' }).details, 'Transpiling to JavaScript')
  assert.equal(buildDiscordActivity({ mode: 'transpile', target: 'python' }).details, 'Transpiling to Python')
  assert.equal(buildDiscordActivity({ mode: 'transpile', target: 'other' }).details, 'Transpiling to code')
  assert.equal(buildDiscordActivity({ mode: 'exercise' }).state, 'Visual programming')
  const serialized = JSON.stringify(buildDiscordActivity({ mode: 'editing', modules: 2, nodes: 3 }))
  assert.ok(!serialized.includes('workspace'))
  assert.ok(!serialized.includes('/home/'))
  assert.ok(!serialized.includes('projectName'))
  assert.ok(!serialized.includes('party'))
  assert.ok(!serialized.includes('secrets'))
})

test('discord : la signature d’activité évite les mises à jour redondantes', () => {
  const first = buildDiscordActivity({ mode: 'editing', modules: 1, nodes: 2 })
  const same = buildDiscordActivity({ mode: 'editing', modules: 1, nodes: 2 })
  const changed = buildDiscordActivity({ mode: 'editing', modules: 1, nodes: 3 })
  assert.equal(discordActivityKey(first), discordActivityKey(same))
  assert.notEqual(discordActivityKey(first), discordActivityKey(changed))
  assert.equal(parseDiscordPresencePreference(null), true)
  assert.equal(parseDiscordPresencePreference('true'), true)
  assert.equal(parseDiscordPresencePreference('false'), false)
  assert.equal(parseDiscordPresencePreference('n’importe quoi'), true)
})

test('discord : le backoff de reconnexion est borné', () => {
  assert.equal(nextDiscordRetryDelay(0), 1000)
  assert.equal(nextDiscordRetryDelay(1), 2000)
  assert.equal(nextDiscordRetryDelay(2), 4000)
  assert.equal(nextDiscordRetryDelay(5), 32000)
  assert.equal(nextDiscordRetryDelay(6), 60000)
  assert.equal(nextDiscordRetryDelay(99), 60000)
  assert.equal(nextDiscordRetryDelay(-1), 1000)
})

test('discord : les chemins du sidecar suivent la plateforme et l’architecture', () => {
  assert.deepEqual(discordPresencePaths('Windows', 'x64', 'C:\\App'), [
    'C:\\App\\discord-presence.exe',
    'C:\\App\\build\\presence\\windows-x64\\discord-presence.exe',
  ])
  assert.deepEqual(discordPresencePaths('Linux', 'x64', '/opt/sapphire/'), [
    '/opt/sapphire/discord-presence',
    '/opt/sapphire/build/presence/linux-x64/discord-presence',
  ])
  assert.deepEqual(discordPresencePaths('Darwin', 'arm64', '/Applications/Sapphire 3.app/Contents/MacOS'), [
    '/Applications/Sapphire 3.app/Contents/MacOS/discord-presence-arm64',
    '/Applications/Sapphire 3.app/Contents/MacOS/build/presence/macos-arm64/discord-presence',
  ])
  assert.deepEqual(discordPresencePaths('Windows', 'arm64', 'C:\\App'), [])
  assert.deepEqual(discordPresencePaths('Linux', 'ia32', '/opt'), [])
  assert.deepEqual(discordPresencePaths('Windows', 'x64', ''), [])
  assert.equal(discordPresenceCommand('C:\\App\\discord-presence.exe', 42), '"C:\\App\\discord-presence.exe" 42')
  assert.equal(discordPresenceCommand('/opt/sapphire/discord-presence', Number.NaN), '"/opt/sapphire/discord-presence" 0')
  assert.equal(discordPresenceCommand('', 1), null)
})

test('discord : le service ne casse rien sans desktop ni Discord', async () => {
  __resetDiscordPresenceForTests()
  assert.deepEqual(await startDiscordPresence(), { ok: false, reason: 'desktop-required' })
  const activity = buildDiscordActivity({ mode: 'ready' })
  assert.deepEqual(updateDiscordPresence(activity), { ok: true })
  assert.deepEqual(updateDiscordPresence(activity), { ok: true, unchanged: true })
  await stopDiscordPresence({ immediate: true })
  assert.deepEqual(updateDiscordPresence(activity), { ok: true })
  await setDiscordPresenceEnabled(false)
  assert.deepEqual(updateDiscordPresence(activity), { ok: false, reason: 'disabled' })
  await setDiscordPresenceEnabled(true)
  assert.equal(readDiscordPresenceEnabled(), true)
  __resetDiscordPresenceForTests()
})
