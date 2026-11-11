// Génère le catalogue de recherche à partir des vraies sections du site, sans réseau.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const pages = [
  ['index.html', 'Application'], ['documentation.html', 'Documentation'],
  ['ast.html', 'Modèle AST'], ['transpilation.html', 'Transpilation'], ['dashboards.html', 'Démos'], ['project.html', 'Projet'],
]
const keywords = {
  projet: 'ouvrir exemple imports canvas navigation demarrer',
  module: 'carte module portee fonction entree etapes retour pure',
  app: 'point entree start here main print application',
  ajouter: 'menu formulaire construction fonction variables types blocs',
  relier: 'import export dependance fleche module lien',
  proprietes: 'renommer exports imports proprietes module',
  executer: 'run live simulation pause stop output sortie vitesse executer',
  exporter: 'transpilation javascript python code copier exporter',
  apparence: 'theme clair sombre palette langue apparence',
  simulation: 'simulation run live pause stop debug debogage breakpoint point arret memoire trace',
  fichier: 'sauvegarde enregistrer autosauvegarde workspace recuperation fichier dossier zip images',
  types: 'classes lambdas fermeture pointeurs generiques tableaux types stricts',
  annotations: 'commentaires notes images katex formules mathematiques',
  constructions: 'fonction variable constante boucle condition print lambda pointeurs generiques',
  portees: 'public private classe classe this constructeur import export',
  execution: 'simulation contrats print live debug',
  transpilation: 'javascript python c transpilation cible backend code export fonctions operations',
  chaine: 'analyse ast portee types diagnostics backend selection point entree contrats',
  matrice: 'perimetre support accepte refuse javascript python c tableaux classes lambdas foreach',
  javascript: 'javascript backend class bigint pointeurs tableaux foreach lambdas math natives',
  python: 'python backend class init self pointeurs listes foreach lambdas math natives',
  operations: 'mathnatives registre operations natives correspondance ajouter backend',
  refus: 'refus diagnostics codes limites transpilation cible',
  limites: 'restrictions compatibilite limitations',
}

// Extrait un texte lisible sans scripts, styles ni balisage.
function plainText(html) {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
}

const entries = [
  { title: 'Télécharger Sapphire 3', category: 'Application', url: 'https://github.com/lalBi94/Sapphire3/releases', text: 'La dernière release et les paquets Windows, Linux et macOS.', keywords: 'telechargement installer installation download beta derniere version', featured: true },
  { title: 'Code source et issues sur GitHub', category: 'Projet', url: 'https://github.com/lalBi94/Sapphire3', text: 'Les sources, l’historique, les issues et le suivi du projet.', keywords: 'github code source depot issues bug rapport', featured: true },
  { title: 'Explorer les dashboards interactifs', category: 'Démos', url: 'dashboards.html', text: 'Douze programmes réels exportés : écrans, boutons, LED et tracés.', keywords: 'demo exemple jouer tester dashboard widgets', featured: true },
  { title: 'Documentation visuelle', category: 'Documentation', url: 'documentation.html', text: 'La visite guidée de Sapphire 3, de la création du projet au débogage.', keywords: 'debuter aide apprendre tutoriel guide', featured: true },
]
for (const [file, category] of pages) {
  const html = await readFile(path.join(root, file), 'utf8')
  const sections = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"[^>]*>/g)]
  for (let index = 0; index < sections.length; index += 1) {
    const match = sections[index]
    const fragment = html.slice(match.index, sections[index + 1]?.index ?? html.lastIndexOf('</main>'))
    const heading = fragment.match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/)
    if (!heading) continue
    const title = plainText(heading[1]).replace(/^\d+\s*[—–−-]\s*/, '')
    const paragraph = fragment.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)
    entries.push({
      title, category, url: `${file}#${match[1]}`,
      text: plainText(fragment).slice(0, 9000),
      excerpt: plainText(paragraph?.[1] ?? heading[1]).slice(0, 160),
      keywords: keywords[match[1]] ?? '',
    })
  }
}
await writeFile(path.join(root, 'assets/search-index.js'), `// Catalogue généré par visual/scripts/build-search.mjs.\nwindow.SapphireSearchEntries = ${JSON.stringify(entries)}\n`)
console.log(`${entries.length} destinations indexées.`)
