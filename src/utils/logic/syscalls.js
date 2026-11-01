import { primitiveType } from './primitives.js'

// Appels système simulés : déterministes et en mémoire, jamais d'effet natif, fichier ou réseau.
// Seul point d'extension du langage : ajouter une entrée suffit à proposer un nouvel appel.
export const syscallDefinitions = Object.freeze({
  write: Object.freeze({
    id: 'write',
    parameters: Object.freeze([primitiveType('string')]),
    returnType: primitiveType('int'),
    // Écrit le texte dans la sortie simulée et renvoie sa longueur.
    run: ({ args, effect }) => { effect.write(args[0]); return BigInt(String(args[0]).length) },
  }),
  tick: Object.freeze({
    id: 'tick',
    parameters: Object.freeze([]),
    returnType: primitiveType('int'),
    // Renvoie l'horloge simulée : le nombre de pas déjà exécutés.
    run: ({ steps }) => BigInt(steps),
  }),
})

// Retourne la définition d'un appel système, ou null si le nom est inconnu.
export function getSyscall(id) {
  return typeof id === 'string' && Object.hasOwn(syscallDefinitions, id) ? syscallDefinitions[id] : null
}

// Liste les identifiants d'appels système, dans l'ordre du registre.
export const syscallIds = Object.freeze(Object.keys(syscallDefinitions))
