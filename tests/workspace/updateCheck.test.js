import test from 'node:test'
import assert from 'node:assert/strict'
import { assetMatchesTarget, compareVersions, isNewerVersion, normalizeUpdateTarget, pickUpdate } from '../../src/utils/updateCheck.js'

const asset = (version, overrides = {}) => ({
  name: `Sapphire3-${version}-windows.zip`,
  browser_download_url: `https://github.com/lalBi94/Sapphire3/releases/download/v${version}/Sapphire3-${version}-windows.zip`,
  size: 1000,
  digest: `sha256:${'a'.repeat(64)}`,
  ...overrides,
})
const namedAsset = (name, version, overrides = {}) => ({
  name,
  browser_download_url: `https://github.com/lalBi94/Sapphire3/releases/download/v${version}/${name}`,
  size: 1000,
  digest: `sha256:${'a'.repeat(64)}`,
  ...overrides,
})
const release = (version, overrides = {}) => ({
  tag_name: `v${version}`,
  name: `Sapphire 3 ${version}`,
  draft: false,
  prerelease: version.includes('-'),
  body: 'notes',
  published_at: '2026-11-02T00:00:00Z',
  assets: [asset(version)],
  ...overrides,
})

test('versions : comparaison sémantique et préversions', () => {
  assert.equal(compareVersions('0.1.0-alpha.4', '0.1.0-alpha.4'), 0)
  assert.equal(compareVersions('0.1.0-alpha.5', '0.1.0-alpha.4'), 1)
  assert.equal(compareVersions('0.1.0-alpha.4', '0.1.0-alpha.5'), -1)
  assert.equal(compareVersions('0.1.0-alpha.4', '0.1.0-beta.1'), -1)
  assert.equal(compareVersions('0.1.0-beta.1', '0.1.0-alpha.9'), 1)
  assert.equal(compareVersions('0.1.0', '0.1.0-alpha.4'), 1)
  assert.equal(compareVersions('0.2.0-alpha.1', '0.1.9'), 1)
  assert.equal(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.10'), -1)
  assert.equal(isNewerVersion('0.1.0-alpha.5', '0.1.0-alpha.4'), true)
  assert.equal(isNewerVersion('0.1.0-alpha.4', '0.1.0-alpha.4'), false)
  assert.equal(compareVersions('v0.1.0-alpha.5', '0.1.0-alpha.4'), 1)
  assert.equal(compareVersions('bogus', '0.1.0'), 0)
})

test('mise à jour : choisit la release publiée la plus récente avec un asset Windows vérifiable', () => {
  const releases = [
    release('0.1.0-alpha.3'),
    release('0.1.0-alpha.5'),
    release('0.1.0-alpha.6', { draft: true }),
    { ...release('0.1.0-alpha.7'), assets: [] },
    release('0.1.0-alpha.8', { assets: [asset('0.1.0-alpha.8', { digest: null })] }),
    release('0.1.0-alpha.4'),
  ]
  const update = pickUpdate(releases, '0.1.0-alpha.4')
  assert.equal(update.version, '0.1.0-alpha.5')
  assert.equal(update.asset.size, 1000)
  assert.equal(update.asset.digest, 'a'.repeat(64))
  assert.equal(pickUpdate(releases, '0.1.0-alpha.5'), null)
  assert.equal(pickUpdate([], '0.1.0-alpha.4'), null)
  assert.equal(pickUpdate(null, '0.1.0-alpha.4'), null)
})

test('mise à jour : refuse un asset sans digest, de taille invalide ou hors GitHub', () => {
  const badDigest = pickUpdate([release('0.1.0-alpha.9', { assets: [asset('0.1.0-alpha.9', { digest: 'sha256:xyz' })] })], '0.1.0-alpha.4')
  assert.equal(badDigest, null)
  const badSize = pickUpdate([release('0.1.0-alpha.9', { assets: [asset('0.1.0-alpha.9', { size: 0 })] })], '0.1.0-alpha.4')
  assert.equal(badSize, null)
  const badHost = pickUpdate([release('0.1.0-alpha.9', { assets: [asset('0.1.0-alpha.9', { browser_download_url: 'https://evil.example/update.zip' })] })], '0.1.0-alpha.4')
  assert.equal(badHost, null)
})

test('cibles : normalisation des systèmes et architectures', () => {
  assert.deepEqual(normalizeUpdateTarget('Windows', 'x64'), { platform: 'windows', arch: 'x64' })
  assert.deepEqual(normalizeUpdateTarget('Linux', 'x64'), { platform: 'linux', arch: 'x64' })
  assert.deepEqual(normalizeUpdateTarget('Linux', 'arm64'), { platform: 'linux', arch: 'arm64' })
  assert.deepEqual(normalizeUpdateTarget('Darwin', 'arm64'), { platform: 'macos', arch: 'arm64' })
  assert.deepEqual(normalizeUpdateTarget('Darwin', 'arm'), { platform: 'macos', arch: 'arm64' })
  assert.equal(normalizeUpdateTarget('FreeBSD', 'x64'), null)
  assert.equal(normalizeUpdateTarget('Linux', 'arm'), null)
  assert.equal(normalizeUpdateTarget('Windows', 'ia32'), null)
})

test('cibles : reconnaissance des archives par plateforme', () => {
  assert.equal(assetMatchesTarget('Sapphire3-0.1.0-beta.6-windows.zip', 'windows', 'x64'), true)
  assert.equal(assetMatchesTarget('Sapphire3-0.1.0-beta.6-linux-x64.tar.gz', 'linux', 'x64'), true)
  assert.equal(assetMatchesTarget('Sapphire3-0.1.0-beta.6-linux-arm64.tar.gz', 'linux', 'arm64'), true)
  assert.equal(assetMatchesTarget('Sapphire3-0.1.0-beta.6-macos-universal.zip', 'macos', 'arm64'), true)
  assert.equal(assetMatchesTarget('Sapphire3-0.1.0-beta.6-macos-x64.zip', 'macos', 'arm64'), false)
  assert.equal(assetMatchesTarget('Sapphire3-0.1.0-beta.6-windows.zip', 'linux', 'x64'), false)
})

test('mise à jour : choisit l’asset de la plateforme et de l’architecture', () => {
  const version = '0.1.0-beta.6'
  const assets = [
    namedAsset(`Sapphire3-${version}-windows.zip`, version),
    namedAsset(`Sapphire3-${version}-linux-x64.tar.gz`, version),
    namedAsset(`Sapphire3-${version}-linux-arm64.tar.gz`, version),
    namedAsset(`Sapphire3-${version}-macos-universal.zip`, version),
    namedAsset(`Sapphire3-${version}-macos-x64.zip`, version),
    namedAsset(`Sapphire3-${version}-macos-arm64.zip`, version),
  ]
  const releases = [release(version, { assets })]

  const windows = pickUpdate(releases, '0.1.0-beta.5', { platform: 'windows', arch: 'x64' })
  assert.equal(windows.asset.name, `Sapphire3-${version}-windows.zip`)
  assert.equal(windows.asset.format, 'zip')
  assert.equal(windows.installMode, 'auto')

  const linux = pickUpdate(releases, '0.1.0-beta.5', { platform: 'linux', arch: 'x64' })
  assert.equal(linux.asset.name, `Sapphire3-${version}-linux-x64.tar.gz`)
  assert.equal(linux.asset.format, 'tar.gz')
  assert.equal(linux.installMode, 'manual')

  const macArm = pickUpdate(releases, '0.1.0-beta.5', { platform: 'macos', arch: 'arm64' })
  assert.equal(macArm.asset.name, `Sapphire3-${version}-macos-universal.zip`)
  const macX64 = pickUpdate(releases, '0.1.0-beta.5', { platform: 'macos', arch: 'x64' })
  assert.equal(macX64.asset.name, `Sapphire3-${version}-macos-universal.zip`)
})

test('mise à jour : repli macOS par architecture et refus des assets incompatibles', () => {
  const version = '0.1.0-beta.6'
  const armOnly = [release(version, { assets: [namedAsset(`Sapphire3-${version}-macos-arm64.zip`, version)] })]
  assert.equal(pickUpdate(armOnly, '0.1.0-beta.5', { platform: 'macos', arch: 'arm64' }).asset.name, `Sapphire3-${version}-macos-arm64.zip`)
  assert.equal(pickUpdate(armOnly, '0.1.0-beta.5', { platform: 'macos', arch: 'x64' }), null)

  const windowsOnly = [release(version, { assets: [namedAsset(`Sapphire3-${version}-windows.zip`, version)] })]
  assert.equal(pickUpdate(windowsOnly, '0.1.0-beta.5', { platform: 'linux', arch: 'x64' }), null)
  assert.equal(pickUpdate(windowsOnly, '0.1.0-beta.5', { platform: 'macos', arch: 'arm64' }), null)

  const wrongRepo = namedAsset(`Sapphire3-${version}-linux-x64.tar.gz`, version, {
    browser_download_url: `https://github.com/other/repo/releases/download/v${version}/Sapphire3-${version}-linux-x64.tar.gz`,
  })
  assert.equal(pickUpdate([release(version, { assets: [wrongRepo] })], '0.1.0-beta.5', { platform: 'linux', arch: 'x64' }), null)
})
