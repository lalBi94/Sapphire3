import test from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, isNewerVersion, pickUpdate } from '../../src/utils/updateCheck.js'

const asset = (version, overrides = {}) => ({
  name: `Sapphire3-${version}-windows.zip`,
  browser_download_url: `https://github.com/lalBi94/Sapphire3/releases/download/v${version}/Sapphire3-${version}-windows.zip`,
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
