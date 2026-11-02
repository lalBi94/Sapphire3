// Version applicative injectée par Vite à la compilation ; repli lisible hors build et dans les tests.
export const appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

// Dépôt public unique du projet, seul lien externe présenté dans l'interface.
export const repositoryUrl = 'https://github.com/lalBi94/Sapphire3'
