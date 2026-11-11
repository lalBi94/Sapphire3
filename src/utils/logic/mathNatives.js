import { primitiveType, arrayType, sameType, isArrayType } from './primitives.js'
import { getPluginNativeDefinitions } from './pluginExtensions.js'

const intType = primitiveType('int')
const doubleType = primitiveType('double')
const stringType = primitiveType('string')
const charType = primitiveType('char')
const booleanType = primitiveType('boolean')
const voidType = primitiveType('void')
// Paramètre générique `T[]` : n'importe quel tableau, sans imposer le type des éléments.
const arrayParameterType = Object.freeze({ kind: 'array', elementType: null })
// Paramètre d'élément lié au premier tableau : `T` doit être le type d'élément de `T[]`.
const arrayElementParameterType = Object.freeze({ kind: 'arrayElement', arrayIndex: 0 })
const stringArrayType = Object.freeze({ kind: 'array', elementType: stringType })
const intArrayType = Object.freeze({ kind: 'array', elementType: intType })
export const screenLimits = Object.freeze({ maximumDimension: 128 })

// Refuse un résultat non fini : le modèle numérique strict n'admet ni NaN ni infini.
function finite(value) {
  if (Number.isFinite(value)) return value
  const error = new Error('Math result is not a finite number.')
  error.code = 'SIMULATION_MATH_DOMAIN'
  throw error
}

// Refuse un indice de texte hors bornes avec un code stable.
function textBounds(message) {
  const error = new Error(message)
  error.code = 'SIMULATION_STRING_BOUNDS'
  throw error
}

// Refuse une opération native qui attend un tableau avec un code stable.
function referenceError(message) {
  const error = new Error(message)
  error.code = 'SIMULATION_REFERENCE'
  throw error
}

// Refuse une adresse ou une portion de tableau hors bornes avec un code stable.
function arrayBounds(message) {
  const error = new Error(message)
  error.code = 'SIMULATION_ARRAY_BOUNDS'
  throw error
}

// Convertit un entier source en index sûr après contrôle du domaine.
function arrayIndexValue(value, maximum) {
  const index = Number(value)
  if (!Number.isInteger(index) || index < 0 || index > maximum) arrayBounds('The array slice is outside its bounds.')
  return index
}

// Retourne une copie du segment [start, end), sans modifier la source.
function sliceArray(array, start, end) {
  if (!Array.isArray(array)) referenceError('The native operation expects an array.')
  const from = arrayIndexValue(start, array.length)
  const to = arrayIndexValue(end, array.length)
  if (from > to) arrayBounds('The array slice is outside its bounds.')
  return array.slice(from, to)
}

// Crée un tableau d'entiers rempli d'une même valeur, sans consommer un pas par case.
function fillArray(sizeValue, value) {
  const size = Number(sizeValue)
  if (!Number.isSafeInteger(size) || size < 0 || size > 1000000) arrayBounds('The array size is outside its bounds.')
  const element = Number(value)
  if (!Number.isInteger(element)) referenceError('The array fill value must be an integer.')
  return new Array(size).fill(BigInt(element))
}

// Retourne l'index du premier élément égal, ou -1 sans lever d'erreur.
function indexOfElement(array, value) {
  if (!Array.isArray(array)) referenceError('The native operation expects an array.')
  return BigInt(array.indexOf(value))
}

// Refuse une dimension d'écran hors limites avec un code stable.
function screenBounds(message) {
  const error = new Error(message)
  error.code = 'SIMULATION_SCREEN_BOUNDS'
  throw error
}

// Refuse une composante de couleur hors de 0..255 avec un code stable.
function screenColor(value) {
  const color = Number(value)
  if (!Number.isInteger(color) || color < 0 || color > 255) {
    const error = new Error('A screen color component must be between 0 and 255.')
    error.code = 'SIMULATION_SCREEN_COLOR'
    throw error
  }
  return color
}

// Refuse une grille, un noyau ou une table de transition invalide.
function gridBounds(message) {
  const error = new Error(message)
  error.code = 'SIMULATION_GRID_BOUNDS'
  throw error
}

// Applique un noyau 2D à une grille plate ; les cases hors grille valent zéro.
function convolveGrid(grid, widthValue, heightValue, kernel, kernelWidthValue, kernelHeightValue) {
  if (!Array.isArray(grid) || !Array.isArray(kernel)) referenceError('The convolution expects a grid and a kernel.')
  const width = Number(widthValue)
  const height = Number(heightValue)
  const kernelWidth = Number(kernelWidthValue)
  const kernelHeight = Number(kernelHeightValue)
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || grid.length < width * height) gridBounds('The convolution grid is invalid.')
  if (!Number.isInteger(kernelWidth) || !Number.isInteger(kernelHeight) || kernelWidth < 1 || kernelHeight < 1 || kernel.length < kernelWidth * kernelHeight) gridBounds('The convolution kernel is invalid.')
  const centerX = Math.floor(kernelWidth / 2)
  const centerY = Math.floor(kernelHeight / 2)
  const result = new Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let total = 0
      for (let ky = 0; ky < kernelHeight; ky += 1) {
        const sourceY = y + ky - centerY
        if (sourceY < 0 || sourceY >= height) continue
        for (let kx = 0; kx < kernelWidth; kx += 1) {
          const sourceX = x + kx - centerX
          if (sourceX < 0 || sourceX >= width) continue
          total += Number(grid[sourceY * width + sourceX] ?? 0) * Number(kernel[ky * kernelWidth + kx] ?? 0)
        }
      }
      result[y * width + x] = BigInt(total)
    }
  }
  return result
}

// Applique une table de 18 entrées indexée par état (0/1) × 9 + nombre de voisins.
function lookupGrid(counts, grid, table) {
  if (!Array.isArray(counts) || !Array.isArray(grid) || !Array.isArray(table)) referenceError('The lookup expects three arrays.')
  if (counts.length !== grid.length || table.length !== 18) gridBounds('The lookup arrays or table have an invalid size.')
  const result = new Array(grid.length)
  for (let index = 0; index < grid.length; index += 1) {
    const state = Number(grid[index])
    const count = Number(counts[index])
    if ((state !== 0 && state !== 1) || !Number.isInteger(count) || count < 0 || count > 8) gridBounds('The lookup grid or counts are invalid.')
    result[index] = BigInt(table[state * 9 + count])
  }
  return result
}

// Écrit une grille de couleurs indexées dans le tampon RGBA d'un écran.
function blitGrid(pixels, widthValue, heightValue, grid, gridWidthValue, gridHeightValue, palette) {
  const dimensions = screenBuffer(pixels, widthValue, heightValue)
  const gridWidth = Number(gridWidthValue)
  const gridHeight = Number(gridHeightValue)
  if (!Array.isArray(grid) || gridWidth !== dimensions.width || gridHeight !== dimensions.height || grid.length < gridWidth * gridHeight) gridBounds('The blit grid must match the screen size.')
  if (!Array.isArray(palette) || palette.length < 4 || palette.length % 4 !== 0) gridBounds('The blit palette is invalid.')
  const colors = palette.length / 4
  for (let index = 0; index < grid.length; index += 1) {
    const colorIndex = Number(grid[index])
    if (!Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex >= colors) gridBounds('A blit color index is outside the palette.')
    const source = colorIndex * 4
    const target = index * 4
    pixels[target] = BigInt(screenColor(palette[source]))
    pixels[target + 1] = BigInt(screenColor(palette[source + 1]))
    pixels[target + 2] = BigInt(screenColor(palette[source + 2]))
    pixels[target + 3] = BigInt(screenColor(palette[source + 3]))
  }
}

// Valide les dimensions et le tampon d'un écran, puis retourne des index sûrs.
function screenBuffer(pixels, width, height) {
  if (!Array.isArray(pixels)) referenceError('The screen expects a pixel array.')
  const w = Number(width)
  const h = Number(height)
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > screenLimits.maximumDimension || h > screenLimits.maximumDimension) screenBounds('The screen dimensions are outside their bounds.')
  if (pixels.length < w * h * 4) screenBounds('The screen pixel buffer is too small.')
  return { width: w, height: h }
}

// Vérifie l'indice d'un pixel et retourne sa position dans le tampon RGBA.
function screenPixelIndex(index, width, height) {
  const position = Number(index)
  if (!Number.isInteger(position) || position < 0 || position >= width * height) screenBounds('The screen pixel index is outside its bounds.')
  return position * 4
}

// Compte les scalaires Unicode avant une position UTF-16.
function unicodeIndexOf(value, search) {
  const index = value.indexOf(search)
  return index < 0 ? -1n : BigInt([...value.slice(0, index)].length)
}

// Calcule le plus grand commun diviseur positif de deux entiers, zéro compris.
function greatestCommonDivisor(left, right) {
  let a = left < 0n ? -left : left
  let b = right < 0n ? -right : right
  while (b !== 0n) {
    const remainder = a % b
    a = b
    b = remainder
  }
  return a
}

// Tire un entier inclusif dans [min, max] et refuse une plage inversée.
function randomInteger(min, max) {
  const lower = Number(min)
  const upper = Number(max)
  if (!Number.isInteger(lower) || !Number.isInteger(upper) || lower > upper) {
    const error = new Error('A random integer range must be ordered.')
    error.code = 'SIMULATION_RANDOM_RANGE'
    throw error
  }
  return BigInt(lower + Math.floor(Math.random() * (upper - lower + 1)))
}

// Registre pur des opérations natives SP3, seul point d'extension de cette famille.
// Chaque entrée fixe son groupe de menu, les types de ses paramètres et son type de retour.
export const mathNatives = Object.freeze({
  clamp: Object.freeze({ id: 'clamp', group: 'native.math', parameters: Object.freeze([intType, intType, intType]), returnType: intType, run: ([value, lower, upper]) => (value < lower ? lower : value > upper ? upper : value) }),
  sign: Object.freeze({ id: 'sign', group: 'native.math', parameters: Object.freeze([intType]), returnType: intType, run: ([value]) => (value < 0n ? -1n : value > 0n ? 1n : 0n) }),
  gcd: Object.freeze({ id: 'gcd', group: 'native.math', parameters: Object.freeze([intType, intType]), returnType: intType, run: ([left, right]) => greatestCommonDivisor(left, right) }),
  lerp: Object.freeze({ id: 'lerp', group: 'native.math', parameters: Object.freeze([doubleType, doubleType, doubleType]), returnType: doubleType, run: ([start, end, ratio]) => finite(start + (end - start) * ratio) }),
  log: Object.freeze({ id: 'log', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.log(value)) }),
  length: Object.freeze({ id: 'length', group: 'native.text', parameters: Object.freeze([stringType]), returnType: intType, run: ([value]) => BigInt([...value].length) }),
  charAt: Object.freeze({
    id: 'charAt',
    group: 'native.text',
    parameters: Object.freeze([stringType, intType]),
    returnType: charType,
    run: ([value, index]) => {
      const characters = [...value]
      const position = Number(index)
      if (!Number.isInteger(position) || position < 0 || position >= characters.length) textBounds('The text index is outside its bounds.')
      return characters[position]
    },
  }),
  substring: Object.freeze({
    id: 'substring',
    group: 'native.text',
    parameters: Object.freeze([stringType, intType, intType]),
    returnType: stringType,
    run: ([value, start, end]) => {
      const characters = [...value]
      const from = Number(start)
      const to = Number(end)
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > to || to > characters.length) textBounds('The text slice is outside its bounds.')
      return characters.slice(from, to).join('')
    },
  }),
  contains: Object.freeze({ id: 'contains', group: 'native.text', parameters: Object.freeze([stringType, stringType]), returnType: booleanType, run: ([value, search]) => value.includes(search) }),
  arraySlice: Object.freeze({
    id: 'arraySlice',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType, intType, intType]),
    returnType: ([array]) => array,
    run: ([value, start, end]) => sliceArray(value, start, end),
  }),
  arrayConcat: Object.freeze({
    id: 'arrayConcat',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType, arrayParameterType]),
    returnType: ([array]) => array,
    check: ([left, right]) => isArrayType(left) && isArrayType(right) && !sameType(left, right) ? 1 : null,
    run: ([left, right]) => {
      if (!Array.isArray(left) || !Array.isArray(right)) referenceError('The native operation expects two arrays.')
      return [...left, ...right]
    },
  }),
  arrayContains: Object.freeze({
    id: 'arrayContains',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType, arrayElementParameterType]),
    returnType: booleanType,
    run: ([value, search]) => {
      if (!Array.isArray(value)) referenceError('The native operation expects an array.')
      return value.includes(search)
    },
  }),
  arrayIndexOf: Object.freeze({
    id: 'arrayIndexOf',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType, arrayElementParameterType]),
    returnType: intType,
    run: ([value, search]) => indexOfElement(value, search),
  }),
  arrayReverse: Object.freeze({
    id: 'arrayReverse',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType]),
    returnType: ([array]) => array,
    run: ([value]) => {
      if (!Array.isArray(value)) referenceError('The native operation expects an array.')
      return [...value].reverse()
    },
  }),
  arrayFill: Object.freeze({
    id: 'arrayFill',
    group: 'native.arrays',
    parameters: Object.freeze([intType, intType]),
    returnType: intArrayType,
    run: ([size, value]) => fillArray(size, value),
  }),
  arrayConvolve: Object.freeze({
    id: 'arrayConvolve',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType, intType, intType, arrayParameterType, intType, intType]),
    returnType: intArrayType,
    run: ([grid, width, height, kernel, kernelWidth, kernelHeight]) => convolveGrid(grid, width, height, kernel, kernelWidth, kernelHeight),
  }),
  arrayLookup: Object.freeze({
    id: 'arrayLookup',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType, arrayParameterType, arrayParameterType]),
    returnType: intArrayType,
    run: ([counts, grid, table]) => lookupGrid(counts, grid, table),
  }),
  stringSplit: Object.freeze({
    id: 'stringSplit',
    group: 'native.text',
    parameters: Object.freeze([stringType, charType]),
    returnType: arrayType(stringType),
    run: ([value, separator]) => {
      if (typeof separator !== 'string') textBounds('The native operation expects a character separator.')
      return value.split(separator)
    },
  }),
  stringJoin: Object.freeze({
    id: 'stringJoin',
    group: 'native.text',
    parameters: Object.freeze([stringArrayType, stringType]),
    returnType: stringType,
    run: ([values, separator]) => {
      if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) referenceError('The native operation expects an array of strings.')
      return values.join(separator)
    },
  }),
  stringIndexOf: Object.freeze({
    id: 'stringIndexOf',
    group: 'native.text',
    parameters: Object.freeze([stringType, stringType]),
    returnType: intType,
    run: ([value, search]) => unicodeIndexOf(value, search),
  }),
  screenSetPixel: Object.freeze({
    id: 'screenSetPixel',
    group: 'native.screen',
    parameters: Object.freeze([intArrayType, intType, intType, intType, intType, intType, intType, intType]),
    returnType: voidType,
    run: ([pixels, width, height, index, red, green, blue, alpha]) => {
      const dimensions = screenBuffer(pixels, width, height)
      const position = screenPixelIndex(index, dimensions.width, dimensions.height)
      pixels[position] = BigInt(screenColor(red))
      pixels[position + 1] = BigInt(screenColor(green))
      pixels[position + 2] = BigInt(screenColor(blue))
      pixels[position + 3] = BigInt(screenColor(alpha))
    },
  }),
  screenGetPixel: Object.freeze({
    id: 'screenGetPixel',
    group: 'native.screen',
    parameters: Object.freeze([intArrayType, intType, intType, intType, intArrayType]),
    returnType: voidType,
    run: ([pixels, width, height, index, output]) => {
      const dimensions = screenBuffer(pixels, width, height)
      const position = screenPixelIndex(index, dimensions.width, dimensions.height)
      if (!Array.isArray(output) || output.length < 4) screenBounds('The output array must contain four elements.')
      output[0] = pixels[position]
      output[1] = pixels[position + 1]
      output[2] = pixels[position + 2]
      output[3] = pixels[position + 3]
    },
  }),
  screenResize: Object.freeze({
    id: 'screenResize',
    group: 'native.screen',
    parameters: Object.freeze([intArrayType, intType, intType, intType, intType]),
    returnType: intArrayType,
    run: ([pixels, width, height, newWidth, newHeight]) => {
      const current = screenBuffer(pixels, width, height)
      const nextWidth = Number(newWidth)
      const nextHeight = Number(newHeight)
      if (!Number.isInteger(nextWidth) || !Number.isInteger(nextHeight) || nextWidth < 1 || nextHeight < 1 || nextWidth > screenLimits.maximumDimension || nextHeight > screenLimits.maximumDimension) screenBounds('The screen dimensions are outside their bounds.')
      const nextPixels = new Array(nextWidth * nextHeight * 4).fill(0n)
      for (let y = 0; y < Math.min(current.height, nextHeight); y += 1) {
        for (let x = 0; x < Math.min(current.width, nextWidth); x += 1) {
          const from = (y * current.width + x) * 4
          const to = (y * nextWidth + x) * 4
          for (let component = 0; component < 4; component += 1) nextPixels[to + component] = pixels[from + component] ?? 0n
        }
      }
      return nextPixels
    },
  }),
  screenBlit: Object.freeze({
    id: 'screenBlit',
    group: 'native.screen',
    parameters: Object.freeze([intArrayType, intType, intType, intArrayType, intType, intType, intArrayType]),
    returnType: voidType,
    run: ([pixels, width, height, grid, gridWidth, gridHeight, palette]) => blitGrid(pixels, width, height, grid, gridWidth, gridHeight, palette),
  }),
  screenPresent: Object.freeze({
    id: 'screenPresent',
    group: 'native.screen',
    parameters: Object.freeze([]),
    returnType: voidType,
    run: () => undefined,
  }),
  arrayLength: Object.freeze({
    id: 'arrayLength',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType]),
    returnType: intType,
    run: ([value]) => {
      if (!Array.isArray(value)) {
        const error = new Error('The native operation expects an array.')
        error.code = 'SIMULATION_REFERENCE'
        throw error
      }
      return BigInt(value.length)
    },
  }),
  abs: Object.freeze({ id: 'abs', group: 'native.math', parameters: Object.freeze([intType]), returnType: intType, run: ([value]) => (value < 0n ? -value : value) }),
  min: Object.freeze({ id: 'min', group: 'native.math', parameters: Object.freeze([intType, intType]), returnType: intType, run: ([left, right]) => (left < right ? left : right) }),
  max: Object.freeze({ id: 'max', group: 'native.math', parameters: Object.freeze([intType, intType]), returnType: intType, run: ([left, right]) => (left > right ? left : right) }),
  pow: Object.freeze({ id: 'pow', group: 'native.math', parameters: Object.freeze([doubleType, doubleType]), returnType: doubleType, run: ([base, exponent]) => finite(Math.pow(base, exponent)) }),
  sqrt: Object.freeze({ id: 'sqrt', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.sqrt(value)) }),
  sin: Object.freeze({ id: 'sin', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.sin(value)) }),
  cos: Object.freeze({ id: 'cos', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.cos(value)) }),
  tan: Object.freeze({ id: 'tan', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.tan(value)) }),
  floor: Object.freeze({ id: 'floor', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.floor(value)) }),
  ceil: Object.freeze({ id: 'ceil', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.ceil(value)) }),
  round: Object.freeze({ id: 'round', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.round(value)) }),
  randomDouble: Object.freeze({ id: 'randomDouble', group: 'native.math', parameters: Object.freeze([]), returnType: doubleType, run: () => Math.random() }),
  randomInt: Object.freeze({ id: 'randomInt', group: 'native.math', parameters: Object.freeze([intType, intType]), returnType: intType, run: ([min, max]) => randomInteger(min, max) }),
})

// Retourne une opération native par son identifiant, ou null si elle est inconnue.
export function getMathNative(id) {
  if (typeof id === 'string' && Object.hasOwn(mathNatives, id)) return mathNatives[id]
  return getPluginNativeDefinitions().find((definition) => definition.id === id) ?? null
}

// Liste toutes les opérations natives disponibles, intégrées puis plugins actifs.
export function getMathNativeEntries() {
  return [...Object.values(mathNatives), ...getPluginNativeDefinitions()]
}

// Liste les identifiants proposés dans les opérations natives, dans l'ordre du registre.
export const mathNativeIds = Object.freeze(Object.keys(mathNatives))
