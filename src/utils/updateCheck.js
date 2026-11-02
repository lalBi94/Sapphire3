// Compare deux versions sémantiques (préversions comprises) : -1, 0 ou 1.
export function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return 0
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] < b.numbers[index] ? -1 : 1
  }
  if (!a.hasPrerelease && !b.hasPrerelease) return 0
  if (!a.hasPrerelease) return 1
  if (!b.hasPrerelease) return -1
  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < length; index += 1) {
    const leftToken = a.prerelease[index]
    const rightToken = b.prerelease[index]
    if (leftToken === undefined) return -1
    if (rightToken === undefined) return 1
    const leftNumeric = /^\d+$/.test(leftToken)
    const rightNumeric = /^\d+$/.test(rightToken)
    if (leftNumeric && rightNumeric) {
      const difference = Number(leftToken) - Number(rightToken)
      if (difference !== 0) return difference < 0 ? -1 : 1
      continue
    }
    if (leftNumeric) return -1
    if (rightNumeric) return 1
    if (leftToken !== rightToken) return leftToken < rightToken ? -1 : 1
  }
  return 0
}

// Vrai si la version candidate est strictement plus récente que la version courante.
export function isNewerVersion(candidate, current) {
  return compareVersions(candidate, current) > 0
}

const assetPattern = /^Sapphire3-(.+)-windows\.zip$/

// Décrit la version d'un enregistrement sémantique, ou null si le format est inconnu.
function parseVersion(value) {
  if (typeof value !== 'string') return null
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value.trim())
  if (!match) return null
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split('.') : [],
    hasPrerelease: Boolean(match[4]),
  }
}

// Choisit la meilleure release publiée plus récente que la version courante, avec un asset Windows vérifiable.
export function pickUpdate(releases, currentVersion) {
  if (!Array.isArray(releases)) return null
  let best = null
  for (const release of releases) {
    if (!release || release.draft === true) continue
    const assets = Array.isArray(release.assets) ? release.assets : []
    for (const asset of assets) {
      if (!asset || typeof asset.name !== 'string' || !assetPattern.test(asset.name)) continue
      const version = asset.name.replace(assetPattern, '$1')
      if (!isNewerVersion(version, currentVersion)) continue
      if (typeof asset.browser_download_url !== 'string' || !asset.browser_download_url.startsWith('https://github.com/')) continue
      const digest = typeof asset.digest === 'string' && /^sha256:[0-9a-f]{64}$/i.test(asset.digest) ? asset.digest.slice(7).toLowerCase() : null
      const size = Number.isSafeInteger(asset.size) && asset.size > 0 ? asset.size : null
      if (!digest || !size) continue
      if (best && compareVersions(version, best.version) <= 0) continue
      best = {
        version,
        tag: typeof release.tag_name === 'string' ? release.tag_name : '',
        name: typeof release.name === 'string' ? release.name : '',
        notes: typeof release.body === 'string' ? release.body : '',
        publishedAt: typeof release.published_at === 'string' ? release.published_at : '',
        asset: { name: asset.name, url: asset.browser_download_url, size, digest },
      }
    }
  }
  return best
}
