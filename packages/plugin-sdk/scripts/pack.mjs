import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Crée le dossier de sortie puis produit l'archive npm locale du SDK plugin.
const packageRoot = resolve(import.meta.dirname, '..')
const destination = resolve(packageRoot, '../../build/sdk')
mkdirSync(destination, { recursive: true })
execSync(`npm pack --pack-destination "${destination}"`, { cwd: packageRoot, stdio: 'inherit' })
