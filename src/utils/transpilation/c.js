import { createDiagnostic } from '../logic/diagnostics.js'
import { validateLiteral } from '../logic/numericConstants.js'
import { child, createGenerationContext, generateSelection } from './context.js'
import { moduleInitializationOrder } from '../logic/moduleInitialization.js'

const reservedWords = new Set([
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else',
  'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long', 'register',
  'restrict', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch',
  'typedef', 'union', 'unsigned', 'void', 'volatile', 'while',
  '_Alignas', '_Alignof', '_Atomic', '_Bool', '_Complex', '_Generic', '_Imaginary',
  '_Noreturn', '_Static_assert', '_Thread_local',
])

const runtimeNames = [
  'sapphire_fail',
  'sapphire_iadd', 'sapphire_isub', 'sapphire_imul', 'sapphire_idiv', 'sapphire_imod',
  'sapphire_uadd', 'sapphire_usub', 'sapphire_umul', 'sapphire_udiv', 'sapphire_umod',
  'sapphire_f32_add', 'sapphire_f32_sub', 'sapphire_f32_mul', 'sapphire_f32_div',
  'sapphire_f64_add', 'sapphire_f64_sub', 'sapphire_f64_mul', 'sapphire_f64_div',
  'sapphire_string_equal',
  'sapphire_print_i16', 'sapphire_print_u16', 'sapphire_print_i32', 'sapphire_print_u32',
  'sapphire_print_f32', 'sapphire_print_f64', 'sapphire_print_bool', 'sapphire_print_string',
  'sapphire_format_number', 'printf', 'fprintf', 'exit', 'strcmp', 'strtod', 'strchr', 'atoi', 'strcpy', 'isfinite',
  'int16_t', 'uint16_t', 'int32_t', 'uint32_t', 'int64_t', 'uint64_t', 'bool', 'true', 'false',
]

// Types primitifs portés par le backend C ; char, tableaux et classes restent hors périmètre.
const cPrimitive = Object.freeze({
  'short int': { type: 'int16_t', category: 'signed', min: '-32768LL', max: '32767LL' },
  'short uint': { type: 'uint16_t', category: 'unsigned', max: '65535ULL' },
  int: { type: 'int32_t', category: 'signed', min: '-2147483648LL', max: '2147483647LL' },
  uint: { type: 'uint32_t', category: 'unsigned', max: '4294967295ULL' },
  float: { type: 'float', category: 'float32' },
  double: { type: 'double', category: 'float64' },
  string: { type: 'const char *', category: 'string' },
  boolean: { type: 'bool', category: 'boolean' },
  void: { type: 'void', category: 'void' },
})

const supportedPrimitives = new Set(['short int', 'short uint', 'int', 'uint', 'float', 'double', 'string', 'boolean'])

// Convertit un type logique en type C, ou null quand le backend ne le porte pas.
function cType(type) {
  if (!type) return null
  if (type.kind === 'primitive') return cPrimitive[type.name]?.type ?? null
  if (type.kind === 'pointer') {
    const pointee = cType(type.pointee)
    return pointee ? `${pointee} *` : null
  }
  return null
}

// Vérifie qu'un type peut apparaître dans une déclaration, un paramètre ou un retour C.
function isSupportedCType(type, depth = 0) {
  if (!type || depth > 20) return false
  if (type.kind === 'primitive') return supportedPrimitives.has(type.name)
  if (type.kind === 'pointer') return type.pointee?.kind === 'primitive' && supportedPrimitives.has(type.pointee.name)
  if (type.kind === 'function') {
    return Array.isArray(type.parameters) &&
      type.parameters.every((parameter) => !isVoid(parameter) && isSupportedCType(parameter, depth + 1)) &&
      (isVoid(type.returnType) || isSupportedCType(type.returnType, depth + 1))
  }
  return false
}

function isVoid(type) {
  return type?.kind === 'primitive' && type.name === 'void'
}

// Seuls les primitifs portés peuvent être imprimés ; les pointeurs n'ont pas de format SP3 en C.
function isPrintableCType(type) {
  return type?.kind === 'primitive' && supportedPrimitives.has(type.name)
}

// Refuse explicitement les constructions hors du sous-ensemble C, avant toute émission.
function cSupportDiagnostics(analysis, selection) {
  const diagnostics = []
  const typeByNode = new Map((analysis.semantic.nodeTypes ?? []).map(({ nodeId, type }) => [nodeId, type]))
  const nodes = analysis.semantic.index.nodes
  const referenceSymbols = analysis.semantic.index.referenceSymbols
  const report = (message, node = null) => {
    if (diagnostics.length >= 20) return
    diagnostics.push(createDiagnostic('TRANSPILE_C_UNSUPPORTED', `Le backend C ne prend pas encore en charge ${message}.`, node?.location ?? { projectId: analysis.ast.sourceId }))
  }

  let selectedModule = null
  let selectedNodes = null
  if (selection) {
    const selected = selection.kind === 'module' ? analysis.ast.modules.find((module) => module.sourceId === selection.id) : nodes.get(selection.id)
    if (!selected) return diagnostics
    selectedModule = selection.kind === 'module' ? selected : analysis.ast.modules.find((module) => module.sourceId === selected.moduleId)
    selectedNodes = new Set()
    const pending = selection.kind === 'module' ? [...selected.body] : [selected]
    while (pending.length) {
      const node = pending.pop()
      if (!node || selectedNodes.has(node.sourceId)) continue
      selectedNodes.add(node.sourceId)
      pending.push(...Object.values(node.children ?? {}).flat().filter((value) => value && typeof value === 'object'))
    }
    if (selectedModule?.moduleKind === 'class') report('les classes')
  } else if (analysis.ast.modules.some((module) => module.moduleKind === 'class')) {
    report('les classes')
  }

  const calleeIds = new Set()
  for (const node of nodes.values()) {
    if (node.kind !== 'CallExpression') continue
    const callee = child(node, 'callee')
    if (callee?.kind === 'Reference') calleeIds.add(callee.sourceId)
  }

  const unsupported = {
    LambdaExpression: 'les lambdas',
    ForEachStatement: 'ForEach',
    MathCall: 'les opérations natives',
    CastExpression: 'les conversions explicites',
    ArrayLiteral: 'les tableaux',
    ArrayCreation: 'les tableaux',
    ArrayAccess: 'les tableaux',
    NewExpression: 'les classes',
    ThisExpression: 'les classes',
    MemberExpression: 'les classes',
    Hole: 'les blocs incomplets',
  }

  for (const node of nodes.values()) {
    if (selection && !selectedNodes.has(node.sourceId)) continue
    if (unsupported[node.kind]) {
      report(unsupported[node.kind], node)
      continue
    }
    const type = typeByNode.get(node.sourceId)
    if (node.kind === 'FunctionDeclaration') {
      const returnType = type?.kind === 'function' ? type.returnType : null
      if (!returnType) report('ce type de retour', node)
      else if (!isVoid(returnType) && !isSupportedCType(returnType)) report('ce type de retour', node)
    } else if (type && !isVoid(type) && !isSupportedCType(type) && !(node.kind === 'Reference' && calleeIds.has(node.sourceId))) {
      report(`le type ${type.kind === 'primitive' ? type.name : type.kind}`, node)
    }
    if (node.kind === 'VariableDeclaration' && !child(node, 'initializer')) report('une variable sans initialiseur', node)
    if (node.kind === 'PrintStatement') {
      const valueType = typeByNode.get(child(node, 'value')?.sourceId)
      if (!isPrintableCType(valueType)) report('ce type dans Print', node)
    }
    if (node.kind === 'CallExpression') {
      const callee = child(node, 'callee')
      if (callee?.kind !== 'Reference' && typeByNode.get(callee?.sourceId)?.kind !== 'function') report('les appels indirects', node)
    }
    if (node.kind === 'UnaryExpression' && node.properties?.operator === '&') {
      const operand = child(node, 'operand')
      if (operand?.kind === 'Reference' && referenceSymbols.get(operand.sourceId)?.kind === 'ConstantDeclaration') report('l’adresse d’une constante', node)
    }
    if (node.kind === 'Literal' && type?.kind === 'primitive' && type.name === 'string') {
      const value = node.properties?.value
      if (typeof value === 'string' && (value.includes('\0') || [...value].some((character) => { const point = character.codePointAt(0); return point >= 0xd800 && point <= 0xdfff }))) report('un texte Unicode incompatible avec C', node)
    }
  }
  return diagnostics
}

// Échappe un texte pour un littéral C, en octal pour éviter toute ambiguïté hexadécimale.
function cStringLiteral(value) {
  let result = '"'
  for (const character of value) {
    const point = character.codePointAt(0)
    if (character === '\\') result += '\\\\'
    else if (character === '"') result += '\\"'
    else if (character === '\n') result += '\\n'
    else if (character === '\r') result += '\\r'
    else if (character === '\t') result += '\\t'
    else if (point < 0x20 || point === 0x7f) result += `\\${point.toString(8).padStart(3, '0')}`
    else result += character
  }
  return `${result}"`
}

// Produit les helpers C de contrôle numérique, d'égalité de chaînes et d'affichage.
function cRuntime() {
  return `static void sapphire_fail(const char *code) {
  fprintf(stderr, "%s\\n", code);
  exit(1);
}

static int64_t sapphire_iadd(int64_t a, int64_t b, int64_t min, int64_t max) {
  int64_t value = a + b;
  if (value < min || value > max) sapphire_fail("NUMERIC_OVERFLOW");
  return value;
}

static int64_t sapphire_isub(int64_t a, int64_t b, int64_t min, int64_t max) {
  int64_t value = a - b;
  if (value < min || value > max) sapphire_fail("NUMERIC_OVERFLOW");
  return value;
}

static int64_t sapphire_imul(int64_t a, int64_t b, int64_t min, int64_t max) {
  int64_t value = a * b;
  if (value < min || value > max) sapphire_fail("NUMERIC_OVERFLOW");
  return value;
}

static int64_t sapphire_idiv(int64_t a, int64_t b, int64_t min, int64_t max) {
  if (b == 0) sapphire_fail("DIVISION_BY_ZERO");
  int64_t value = a / b;
  if (value < min || value > max) sapphire_fail("NUMERIC_OVERFLOW");
  return value;
}

static int64_t sapphire_imod(int64_t a, int64_t b, int64_t min, int64_t max) {
  if (b == 0) sapphire_fail("DIVISION_BY_ZERO");
  int64_t value = a % b;
  if (value < min || value > max) sapphire_fail("NUMERIC_OVERFLOW");
  return value;
}

static uint64_t sapphire_uadd(uint64_t a, uint64_t b, uint64_t max) {
  uint64_t value = a + b;
  if (value > max) sapphire_fail("NUMERIC_OVERFLOW");
  return value;
}

static uint64_t sapphire_usub(uint64_t a, uint64_t b) {
  if (a < b) sapphire_fail("NUMERIC_UNDERFLOW");
  return a - b;
}

static uint64_t sapphire_umul(uint64_t a, uint64_t b, uint64_t max) {
  uint64_t value = a * b;
  if (value > max) sapphire_fail("NUMERIC_OVERFLOW");
  return value;
}

static uint64_t sapphire_udiv(uint64_t a, uint64_t b) {
  if (b == 0) sapphire_fail("DIVISION_BY_ZERO");
  return a / b;
}

static uint64_t sapphire_umod(uint64_t a, uint64_t b) {
  if (b == 0) sapphire_fail("DIVISION_BY_ZERO");
  return a % b;
}

static float sapphire_f32_add(float a, float b) {
  float value = a + b;
  if (!isfinite(value)) sapphire_fail("NUMERIC_OVERFLOW");
  return value;
}

static float sapphire_f32_sub(float a, float b) {
  float value = a - b;
  if (!isfinite(value)) sapphire_fail("NUMERIC_OVERFLOW");
  return value;
}

static float sapphire_f32_mul(float a, float b) {
  float value = a * b;
  if (!isfinite(value)) sapphire_fail("NUMERIC_OVERFLOW");
  if (value == 0.0f && a != 0.0f && b != 0.0f) sapphire_fail("NUMERIC_UNDERFLOW");
  return value;
}

static float sapphire_f32_div(float a, float b) {
  if (b == 0.0f) sapphire_fail("DIVISION_BY_ZERO");
  float value = a / b;
  if (!isfinite(value)) sapphire_fail("NUMERIC_OVERFLOW");
  if (value == 0.0f && a != 0.0f) sapphire_fail("NUMERIC_UNDERFLOW");
  return value;
}

static double sapphire_f64_add(double a, double b) {
  double value = a + b;
  if (!isfinite(value)) sapphire_fail("NUMERIC_OVERFLOW");
  return value;
}

static double sapphire_f64_sub(double a, double b) {
  double value = a - b;
  if (!isfinite(value)) sapphire_fail("NUMERIC_OVERFLOW");
  return value;
}

static double sapphire_f64_mul(double a, double b) {
  double value = a * b;
  if (!isfinite(value)) sapphire_fail("NUMERIC_OVERFLOW");
  if (value == 0.0 && a != 0.0 && b != 0.0) sapphire_fail("NUMERIC_UNDERFLOW");
  return value;
}

static double sapphire_f64_div(double a, double b) {
  if (b == 0.0) sapphire_fail("DIVISION_BY_ZERO");
  double value = a / b;
  if (!isfinite(value)) sapphire_fail("NUMERIC_OVERFLOW");
  if (value == 0.0 && a != 0.0) sapphire_fail("NUMERIC_UNDERFLOW");
  return value;
}

static bool sapphire_string_equal(const char *a, const char *b) {
  return strcmp(a, b) == 0;
}

static void sapphire_format_number(char *buffer, size_t size, double value) {
  if (value == 0.0) {
    strcpy(buffer, "0");
    return;
  }
  for (int precision = 1; precision <= 17; precision++) {
    snprintf(buffer, size, "%.*g", precision, value);
    if (strtod(buffer, NULL) == value) break;
  }
  char *exponent = strchr(buffer, 'e');
  if (exponent) {
    int power = atoi(exponent + 1);
    double magnitude = value < 0 ? -value : value;
    if (magnitude >= 1e-6 && magnitude < 1e21) {
      *exponent = '\\0';
      char mantissa[64];
      strcpy(mantissa, buffer);
      char digits[64];
      int length = 0;
      int point = -1;
      for (int index = 0; mantissa[index] != '\\0'; index++) {
        if (mantissa[index] == '-') { digits[length++] = '-'; continue; }
        if (mantissa[index] == '.') { point = length; continue; }
        digits[length++] = mantissa[index];
      }
      if (point < 0) point = length;
      point += power;
      int start = digits[0] == '-' ? 1 : 0;
      int write = 0;
      if (digits[0] == '-') buffer[write++] = '-';
      if (point <= start) {
        buffer[write++] = '0';
        buffer[write++] = '.';
        for (int index = 0; index < start - point; index++) buffer[write++] = '0';
        for (int index = start; index < length; index++) buffer[write++] = digits[index];
      } else if (point >= length) {
        for (int index = start; index < length; index++) buffer[write++] = digits[index];
        for (int index = 0; index < point - length; index++) buffer[write++] = '0';
      } else {
        for (int index = start; index < point; index++) buffer[write++] = digits[index];
        buffer[write++] = '.';
        for (int index = point; index < length; index++) buffer[write++] = digits[index];
      }
      buffer[write] = '\\0';
      return;
    }
    snprintf(exponent, size - (size_t)(exponent - buffer), "e%+d", power);
  }
}

static void sapphire_print_i16(int16_t value) { printf("%d\\n", (int)value); }
static void sapphire_print_u16(uint16_t value) { printf("%u\\n", (unsigned)value); }
static void sapphire_print_i32(int32_t value) { printf("%" PRId32 "\\n", value); }
static void sapphire_print_u32(uint32_t value) { printf("%" PRIu32 "\\n", value); }
static void sapphire_print_f32(float value) { char buffer[64]; sapphire_format_number(buffer, sizeof buffer, (double)value); printf("%s\\n", buffer); }
static void sapphire_print_f64(double value) { char buffer[64]; sapphire_format_number(buffer, sizeof buffer, value); printf("%s\\n", buffer); }
static void sapphire_print_bool(bool value) { printf("%s\\n", value ? "true" : "false"); }
static void sapphire_print_string(const char *value) { printf("%s\\n", value); }
`
}

// Produit le code C d'un programme Sapphire déjà analysé.
export function generateC(analysis, { selection = null } = {}) {
  const support = cSupportDiagnostics(analysis, selection)
  if (support.length) return { ok: false, code: '', diagnostics: support }
  const context = createGenerationContext(analysis, { selection, reservedWords, runtimeNames })
  const { ast, nodes, diagnostics, typeByNode, generatedNames, reserveDeclaration, reserveSyntheticName, referenceName, entryName } = context
  const functionTypedefs = new Map()
  const resolvingTypedefs = new Set()
  let functionTypedefCounter = 0

  function typeKey(type) {
    if (!type) return 'null'
    if (type.kind === 'primitive') return `p:${type.name}`
    if (type.kind === 'pointer') return `ptr:${typeKey(type.pointee)}`
    if (type.kind === 'function') return `fn:${type.parameters.map(typeKey).join(',')}->${typeKey(type.returnType)}`
    return `${type.kind}:${type.name ?? type.classId ?? ''}`
  }

  // Émet un typedef pour une signature de fonction C et retourne son nom.
  function functionTypedef(type) {
    const key = typeKey(type)
    const existing = functionTypedefs.get(key)
    if (existing) return existing.name
    if (resolvingTypedefs.has(key)) return 'sapphire_fn_invalid'
    resolvingTypedefs.add(key)
    const returnType = codeType(type.returnType)
    const parameters = type.parameters.map(codeType)
    if (!returnType || parameters.some((parameter) => !parameter)) {
      resolvingTypedefs.delete(key)
      return 'sapphire_fn_invalid'
    }
    const name = reserveSyntheticName(`sapphire_fn_${functionTypedefCounter++}`)
    functionTypedefs.set(key, { name, returnType, parameters })
    resolvingTypedefs.delete(key)
    return name
  }

  function codeType(type) {
    if (type?.kind === 'function') return functionTypedef(type)
    return cType(type)
  }

  function typeOf(node) {
    return typeByNode.get(node?.sourceId) ?? node?.properties?.type ?? null
  }

  function literalCode(node) {
    const type = typeOf(node)
    const info = type?.kind === 'primitive' ? cPrimitive[type.name] : null
    if (!info) {
      diagnostics.push(createDiagnostic('TRANSPILE_C_UNSUPPORTED', 'Ce littéral n’est pas pris en charge par le backend C.', node.location))
      return '0'
    }
    const literal = validateLiteral(type.name, node.properties?.value)
    if (literal.code) {
      diagnostics.push(createDiagnostic('TRANSPILE_C_UNSUPPORTED', 'Ce littéral n’est pas pris en charge par le backend C.', node.location))
      return '0'
    }
    const value = literal.value
    if (info.category === 'string') return cStringLiteral(value)
    if (info.category === 'boolean') return value ? 'true' : 'false'
    if (info.category === 'signed' || info.category === 'unsigned') return `((${info.type})(${value.toString()}))`
    if (Object.is(value, -0)) return info.category === 'float32' ? '((float)(-0.0))' : '((double)(-0.0))'
    const text = /[.eE]/.test(String(value)) ? String(value) : `${value}.0`
    return `((${info.type})(${text}))`
  }

  // Génère les opérations numériques avec les contrôles de bornes du simulateur.
  function binaryCode(node) {
    const leftNode = child(node, 'left')
    const rightNode = child(node, 'right')
    const left = expression(leftNode)
    const right = expression(rightNode)
    const operator = node.properties?.operator
    const type = typeOf(leftNode)
    if (operator === 'and') return `(${left} && ${right})`
    if (operator === 'or') return `(${left} || ${right})`
    if (operator === '==' || operator === '!=') {
      if (type?.kind === 'primitive' && type.name === 'string') {
        const equality = `sapphire_string_equal(${left}, ${right})`
        return operator === '!=' ? `(!${equality})` : equality
      }
      return `(${left} ${operator} ${right})`
    }
    if (['<', '<=', '>', '>='].includes(operator)) return `(${left} ${operator} ${right})`
    const info = type?.kind === 'primitive' ? cPrimitive[type.name] : null
    if (!info) {
      diagnostics.push(createDiagnostic('TRANSPILE_C_UNSUPPORTED', 'Cette opération n’est pas prise en charge par le backend C.', node.location))
      return '0'
    }
    if (info.category === 'signed') {
      const helper = { '+': 'sapphire_iadd', '-': 'sapphire_isub', '*': 'sapphire_imul', '/': 'sapphire_idiv', '%': 'sapphire_imod' }[operator]
      if (!helper) return '0'
      return `((${info.type})(${helper}((int64_t)(${left}), (int64_t)(${right}), ${info.min}, ${info.max})))`
    }
    if (info.category === 'unsigned') {
      const helper = { '+': 'sapphire_uadd', '-': 'sapphire_usub', '*': 'sapphire_umul', '/': 'sapphire_udiv', '%': 'sapphire_umod' }[operator]
      if (!helper) return '0'
      const args = ['+', '*'].includes(operator)
        ? `(uint64_t)(${left}), (uint64_t)(${right}), ${info.max}`
        : `(uint64_t)(${left}), (uint64_t)(${right})`
      return `((${info.type})(${helper}(${args})))`
    }
    if (info.category === 'float32' || info.category === 'float64') {
      const prefix = info.category === 'float32' ? 'sapphire_f32' : 'sapphire_f64'
      const helper = { '+': `${prefix}_add`, '-': `${prefix}_sub`, '*': `${prefix}_mul`, '/': `${prefix}_div` }[operator]
      return helper ? `${helper}(${left}, ${right})` : '0'
    }
    diagnostics.push(createDiagnostic('TRANSPILE_C_UNSUPPORTED', 'Cette opération n’est pas prise en charge par le backend C.', node.location))
    return '0'
  }

  function unaryCode(node) {
    const operator = node.properties?.operator
    const operand = expression(child(node, 'operand'))
    if (operator === 'not') return `(!(${operand}))`
    if (operator === '+') return `(${operand})`
    if (operator === '&') return `(&(${operand}))`
    if (operator === '*') return `(*(${operand}))`
    if (operator === '-') {
      const info = cPrimitive[typeOf(node)?.name]
      if (info?.category === 'signed') return `((${info.type})(sapphire_isub(0, (int64_t)(${operand}), ${info.min}, ${info.max})))`
      if (info?.category === 'float32' || info?.category === 'float64') return `(-(${operand}))`
    }
    diagnostics.push(createDiagnostic('TRANSPILE_C_UNSUPPORTED', 'Cette opération unaire n’est pas prise en charge par le backend C.', node.location))
    return '0'
  }

  function expression(node) {
    if (!node) return '0'
    if (node.kind === 'Literal') return literalCode(node)
    if (node.kind === 'Reference') return referenceName(node)
    if (node.kind === 'BinaryExpression') return binaryCode(node)
    if (node.kind === 'UnaryExpression') return unaryCode(node)
    if (node.kind === 'CallExpression') return `${expression(child(node, 'callee'))}(${(node.children.arguments ?? []).map(expression).join(', ')})`
    diagnostics.push(createDiagnostic('TRANSPILE_C_UNSUPPORTED', 'Cette expression n’est pas prise en charge par le backend C.', node.location))
    return '0'
  }

  function declaration(node, indent, inline = false) {
    const type = codeType(typeOf(node))
    const name = reserveDeclaration(node)
    const initializer = child(node, 'initializer')
    if (!type || !initializer) {
      diagnostics.push(createDiagnostic('TRANSPILE_C_UNSUPPORTED', 'Cette déclaration n’est pas prise en charge par le backend C.', node.location))
      return ''
    }
    const line = `${type} ${name} = ${expression(initializer)}`
    return inline ? line : `${indent}${line};`
  }

  function printCall(node) {
    const value = child(node, 'value')
    const type = typeOf(value)
    const helper = type?.kind === 'primitive' ? {
      'short int': 'sapphire_print_i16',
      'short uint': 'sapphire_print_u16',
      int: 'sapphire_print_i32',
      uint: 'sapphire_print_u32',
      float: 'sapphire_print_f32',
      double: 'sapphire_print_f64',
      boolean: 'sapphire_print_bool',
      string: 'sapphire_print_string',
    }[type.name] : null
    if (!helper) {
      diagnostics.push(createDiagnostic('TRANSPILE_C_UNSUPPORTED', 'Ce type ne peut pas être imprimé par le backend C.', node.location))
      return '0'
    }
    return `${helper}(${expression(value)})`
  }

  function block(node, level) {
    const indent = '  '.repeat(level)
    const lines = (node?.children?.statements ?? []).map((statement) => statementCode(statement, level)).filter(Boolean)
    return `{\n${lines.join('\n')}${lines.length ? '\n' : ''}${'  '.repeat(Math.max(0, level - 1))}}`
  }

  function statementCode(node, level) {
    if (!node) return ''
    const indent = '  '.repeat(level)
    if (node.kind === 'VariableDeclaration' || node.kind === 'ConstantDeclaration') return declaration(node, indent)
    if (node.kind === 'ExpressionStatement') return `${indent}${expression(child(node, 'expression'))};`
    if (node.kind === 'AssignmentStatement') {
      const target = child(node, 'target')
      const value = expression(child(node, 'value'))
      if (target?.kind === 'Reference') return `${indent}${referenceName(target)} = ${value};`
      if (target?.kind === 'UnaryExpression' && target.properties.operator === '*') return `${indent}(*(${expression(child(target, 'operand'))})) = ${value};`
      diagnostics.push(createDiagnostic('TRANSPILE_C_UNSUPPORTED', 'Cette cible d’affectation n’est pas prise en charge par le backend C.', node.location))
      return ''
    }
    if (node.kind === 'PrintStatement') return `${indent}${printCall(node)};`
    if (node.kind === 'ReturnStatement') {
      const argument = child(node, 'argument')
      return `${indent}return${argument ? ` ${expression(argument)}` : ''};`
    }
    if (node.kind === 'BreakStatement') return `${indent}break;`
    if (node.kind === 'ContinueStatement') return `${indent}continue;`
    if (node.kind === 'IfStatement') {
      const alternate = child(node, 'alternate')
      return `${indent}if (${expression(child(node, 'test'))}) ${block(child(node, 'consequent'), level + 1)}${alternate ? ` else ${block(alternate, level + 1)}` : ''}`
    }
    if (node.kind === 'WhileStatement') return `${indent}while (${expression(child(node, 'test'))}) ${block(child(node, 'body'), level + 1)}`
    if (node.kind === 'ForStatement') {
      const initializer = child(node, 'initializer')
      const test = child(node, 'test')
      const update = child(node, 'update')
      const init = initializer
        ? ['VariableDeclaration', 'ConstantDeclaration'].includes(initializer.kind)
          ? declaration(initializer, '', true)
          : statementCode(initializer, 0).replace(/;\s*$/, '')
        : ''
      const updateCode = update
        ? update.kind === 'AssignmentStatement' ? statementCode(update, 0).replace(/;\s*$/, '') : expression(update)
        : ''
      return `${indent}for (${init}; ${test ? expression(test) : ''}; ${updateCode}) ${block(child(node, 'body'), level + 1)}`
    }
    if (node.kind === 'Block') return `${indent}${block(node, level + 1)}`
    if (node.kind === 'TypeDeclaration') return ''
    diagnostics.push(createDiagnostic('TRANSPILE_C_UNSUPPORTED', 'Cette instruction n’est pas prise en charge par le backend C.', node.location))
    return ''
  }

  function signature(node) {
    const returnType = codeType(typeOf(node)?.kind === 'function' ? typeOf(node).returnType : node.properties?.type)
    const name = generatedNames.get(node.sourceId) ?? reserveDeclaration(node)
    const parameters = (node.children.parameters ?? []).map((parameter) => `${codeType(typeOf(parameter))} ${reserveDeclaration(parameter)}`)
    return `static ${returnType} ${name}(${parameters.length ? parameters.join(', ') : 'void'})`
  }

  function functionCode(node) {
    return `${signature(node)} ${block(child(node, 'body'), 1)}`
  }

  const preview = generateSelection(context, { functionCode, statementCode, expression })
  if (preview) return preview

  const prototypes = []
  const functions = []
  const globalDeclarations = []
  const globalInitializers = []
  const modulesById = new Map(ast.modules.map((module) => [module.sourceId, module]))
  const orderedModules = moduleInitializationOrder(analysis.source, analysis)
    .map((module) => modulesById.get(module.id))
    .filter((module) => module && module.moduleKind !== 'class')
  for (const module of ast.modules) if (module.moduleKind !== 'class' && !orderedModules.includes(module)) orderedModules.push(module)

  for (const module of orderedModules) {
    for (const node of module.body) {
      if (node.kind === 'FunctionDeclaration') {
        prototypes.push(`${signature(node)};`)
        functions.push(functionCode(node))
      } else if (node.kind === 'VariableDeclaration' || node.kind === 'ConstantDeclaration') {
        const type = codeType(typeOf(node))
        const name = reserveDeclaration(node)
        globalDeclarations.push(`static ${type} ${name};`)
        globalInitializers.push(`  ${name} = ${expression(child(node, 'initializer'))};`)
      } else {
        const code = statementCode(node, 1)
        if (code) globalInitializers.push(code)
      }
    }
  }

  const typedefs = [...functionTypedefs.values()].map(({ name, returnType, parameters }) => `typedef ${returnType} (*${name})(${parameters.length ? parameters.join(', ') : 'void'});`)
  const code = [
    '// Generated by Sapphire 3. Do not edit this file.',
    '#include <stdint.h>',
    '#include <inttypes.h>',
    '#include <stdbool.h>',
    '#include <stdio.h>',
    '#include <stdlib.h>',
    '#include <string.h>',
    '#include <math.h>',
    '',
    cRuntime(),
    ...typedefs,
    ...globalDeclarations,
    '',
    ...prototypes,
    '',
    ...functions,
    '',
    'int main(void) {',
    ...globalInitializers,
    ...(entryName ? [`  ${entryName}();`] : []),
    '  return 0;',
    '}',
    '',
  ].join('\n')
  return { code: diagnostics.length ? '' : code, diagnostics }
}
