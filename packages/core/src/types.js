import {
  arrayType,
  classType,
  functionType,
  pointerType,
  primitiveType,
  sameType,
  typeFromRecord,
} from '../../../src/utils/logic/index.js'

export {
  arrayType,
  classType,
  functionType,
  pointerType,
  primitiveType,
  sameType,
  typeFromRecord,
}

/**
 * Types primitifs et constructeurs canoniques, figés. Ce sont des données
 * partagées en lecture seule ; le moteur ne modifie jamais un objet de type.
 */
export const types = Object.freeze({
  shortInt: primitiveType('short int'),
  shortUint: primitiveType('short uint'),
  int: primitiveType('int'),
  uint: primitiveType('uint'),
  float: primitiveType('float'),
  double: primitiveType('double'),
  string: primitiveType('string'),
  char: primitiveType('char'),
  boolean: primitiveType('boolean'),
  void: primitiveType('void'),
  pointerTo: pointerType,
  arrayOf: arrayType,
  functionOf: functionType,
  classOf: classType,
})
