import { primitiveType } from './primitives.js'

// Appels système simulés : déterministes et en mémoire, jamais d'effet natif, fichier ou réseau.
// Seul point d'extension du langage : ajouter une entrée suffit à proposer un nouvel appel.
// `group` place l'entrée dans une catégorie du menu, éventuellement une sous-catégorie (`native.math`).
export const syscallDefinitions = Object.freeze({
  write: Object.freeze({
    id: 'write',
    group: 'native',
    parameters: Object.freeze([primitiveType('string')]),
    returnType: primitiveType('int'),
    // Écrit le texte dans la sortie simulée et renvoie sa longueur.
    run: ({ args, effect }) => { effect.write(args[0]); return BigInt(String(args[0]).length) },
  }),
  tick: Object.freeze({
    id: 'tick',
    group: 'native',
    parameters: Object.freeze([]),
    returnType: primitiveType('int'),
    // Renvoie l'horloge simulée : le nombre de pas déjà exécutés.
    run: ({ steps }) => BigInt(steps),
  }),
  abs: Object.freeze({
    id: 'abs',
    group: 'native.math',
    parameters: Object.freeze([primitiveType('int')]),
    returnType: primitiveType('int'),
    // Valeur absolue d'un entier, sans conversion implicite.
    run: ({ args }) => (args[0] < 0n ? -args[0] : args[0]),
  }),
  min: Object.freeze({
    id: 'min',
    group: 'native.math',
    parameters: Object.freeze([primitiveType('int'), primitiveType('int')]),
    returnType: primitiveType('int'),
    // Plus petit des deux entiers.
    run: ({ args }) => (args[0] < args[1] ? args[0] : args[1]),
  }),
  max: Object.freeze({
    id: 'max',
    group: 'native.math',
    parameters: Object.freeze([primitiveType('int'), primitiveType('int')]),
    returnType: primitiveType('int'),
    // Plus grand des deux entiers.
    run: ({ args }) => (args[0] > args[1] ? args[0] : args[1]),
  }),
})

// Retourne la définition d'un appel système, ou null si le nom est inconnu.
export function getSyscall(id) {
  return typeof id === 'string' && Object.hasOwn(syscallDefinitions, id) ? syscallDefinitions[id] : null
}

// Liste les identifiants d'appels système, dans l'ordre du registre.
export const syscallIds = Object.freeze(Object.keys(syscallDefinitions))
