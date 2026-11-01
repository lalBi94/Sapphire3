// Version applicative injectée par Vite à la compilation ; repli lisible hors build et dans les tests.
export const appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
