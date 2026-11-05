import { primitiveDefinitions } from '../logic/primitives.js'
import { diagnosticCodes } from '../logic/diagnostics.js'

export const pythonRuntimeNames = [
  '_sapphireMath', '_sapphireStruct', '_sapphireRandom', '_sapphireTypes', '_sapphireCodes',
  'sapphireUninitialized', 'sapphireRead', 'sapphireCheck', 'sapphireBinary',
  'sapphireUnary', 'sapphireCast', 'sapphireFormat', 'sapphireQuotient',
  'sapphireArray', 'sapphireElement', 'sapphireWrite', '_SapphirePointer',
  'sapphirePointer', 'sapphireElementPointer', 'sapphireDeref', 'sapphireDerefWrite', 'sapphirePointerEqual', 'sapphireForEach',
  'sapphireArraySlice', 'sapphireArrayIndexOf',
  'sapphireFinite', 'sapphireClamp', 'sapphireSign', 'sapphireLerp',
  'sapphireCharAt', 'sapphireSubstring', 'sapphireLog', 'sapphireSqrt',
  'sapphirePow', 'sapphireFloor', 'sapphireCeil', 'sapphireRound',
  'print', 'object', 'isinstance', 'bool', 'int', 'float', 'str', 'repr', 'abs', 'len', 'min', 'max', 'RuntimeError', 'OverflowError', 'ValueError',
]

// Embarque uniquement l'adaptation runtime Python, alimentée par les bornes/codes du moteur commun.
export function pythonRuntime() {
  const types = Object.fromEntries(Object.entries(primitiveDefinitions).map(([name, definition]) => [name, { category: definition.category, bits: definition.bits, min: definition.min, max: definition.max }]))
  return `# Contrôles Sapphire : bornes et codes issus du moteur commun.
import math as _sapphireMath
import struct as _sapphireStruct
import random as _sapphireRandom

_sapphireTypes = ${JSON.stringify(types)}
_sapphireCodes = ${JSON.stringify(diagnosticCodes)}
sapphireUninitialized = object()

# Refuse les lectures avant initialisation sans inventer une valeur Python.
def sapphireRead(value):
    if value is sapphireUninitialized:
        raise RuntimeError("SIMULATION_UNINITIALIZED")
    return value

# Applique les mêmes bornes, arrondis binaire32 et refus de sous-flux que Sapphire.
def sapphireCheck(value, type_name, nonzero=False):
    definition = _sapphireTypes[type_name]
    if definition["category"] == "integer":
        if value < definition["min"] or value > definition["max"]:
            raise RuntimeError(_sapphireCodes["overflow"])
        return value
    try:
        rounded = _sapphireStruct.unpack("!f", _sapphireStruct.pack("!f", value))[0] if definition["bits"] == 32 else value
    except OverflowError:
        raise RuntimeError(_sapphireCodes["overflow"]) from None
    if not _sapphireMath.isfinite(rounded):
        raise RuntimeError(_sapphireCodes["overflow"])
    if rounded == 0 and (value != 0 or nonzero):
        raise RuntimeError(_sapphireCodes["underflow"])
    return rounded

# Tronque vers zéro, contrairement à la division entière native des négatifs en Python.
def sapphireQuotient(left, right):
    quotient = abs(left) // abs(right)
    return -quotient if (left < 0) != (right < 0) else quotient

# Garde le signe du reste et les calculs entiers exacts, sans promotion implicite.
def sapphireBinary(operator, left, right, type_name):
    if operator in ("/", "%") and right == 0:
        raise RuntimeError(_sapphireCodes["divisionByZero"])
    if operator == "==": return left == right
    if operator == "!=": return left != right
    if operator == "<": return left < right
    if operator == "<=": return left <= right
    if operator == ">": return left > right
    if operator == ">=": return left >= right
    if operator == "+": value = left + right
    elif operator == "-": value = left - right
    elif operator == "*": value = left * right
    elif operator == "/": value = sapphireQuotient(left, right) if _sapphireTypes[type_name]["category"] == "integer" else left / right
    elif operator == "%": value = left - sapphireQuotient(left, right) * right
    else: raise RuntimeError(_sapphireCodes["typeMismatch"])
    return sapphireCheck(value, type_name, operator in ("*", "/") and left != 0 and right != 0)

# Applique les opérations unaires après le typage statique partagé.
def sapphireUnary(operator, value, type_name):
    if operator == "not": return not value
    return sapphireCheck(-value if operator == "-" else value, type_name)

# Tronque les conversions entières et arrondit les conversions flottantes explicitement demandées.
def sapphireCast(value, type_name):
    converted = int(value) if _sapphireTypes[type_name]["category"] == "integer" else float(value)
    return sapphireCheck(converted, type_name)

# Contrôle la taille demandée d'un tableau avant toute allocation.
def sapphireArray(length):
    if not isinstance(length, int) or isinstance(length, bool) or length < 0:
        raise RuntimeError("SIMULATION_ARRAY_BOUNDS")
    return length

# Lit un élément en refusant les cases jamais remplies et les index hors des bornes.
def sapphireElement(array, index):
    if index < 0 or index >= len(array):
        raise RuntimeError("SIMULATION_ARRAY_BOUNDS")
    value = array[index]
    if value is sapphireUninitialized:
        raise RuntimeError("SIMULATION_UNINITIALIZED")
    return value

# Écrit un élément en refusant les index hors des bornes, sans jamais étendre la liste.
def sapphireWrite(array, index, value):
    if index < 0 or index >= len(array):
        raise RuntimeError("SIMULATION_ARRAY_BOUNDS")
    array[index] = value

# Représente une adresse stable vers une cellule ou une case de tableau.
class _SapphirePointer:
    __slots__ = ("target", "index", "constant", "label")

    def __init__(self, target, index, constant, label):
        self.target = target
        self.index = index
        self.constant = constant
        self.label = label

    def read(self):
        if self.index is None:
            return sapphireRead(self.target[0])
        return sapphireElement(self.target, self.index)

    def write(self, value):
        if self.constant:
            raise RuntimeError("SIMULATION_CONST_IMMUTABLE")
        if self.index is None:
            self.target[0] = value
        else:
            sapphireWrite(self.target, self.index, value)

    def __eq__(self, other):
        return isinstance(other, _SapphirePointer) and self.target is other.target and self.index == other.index

    def __hash__(self):
        return hash((id(self.target), self.index))

    def __str__(self):
        return self.label

def sapphirePointer(target, index, constant, label):
    return _SapphirePointer(target, index, constant, label)

def sapphireElementPointer(array, index, constant):
    if not isinstance(array, list):
        raise RuntimeError("SIMULATION_REFERENCE")
    return _SapphirePointer(array, index, constant, "&[" + str(index) + "]")

def sapphireDeref(pointer):
    if not isinstance(pointer, _SapphirePointer):
        raise RuntimeError("SIMULATION_REFERENCE")
    return pointer.read()

def sapphireDerefWrite(pointer, value):
    if not isinstance(pointer, _SapphirePointer):
        raise RuntimeError("SIMULATION_REFERENCE")
    if pointer.constant:
        raise RuntimeError("SIMULATION_CONST_IMMUTABLE")
    pointer.write(value)

def sapphirePointerEqual(left, right):
    return isinstance(left, _SapphirePointer) and isinstance(right, _SapphirePointer) and left.target is right.target and left.index == right.index

# Parcourt une copie de la liste pour figer les éléments visités.
def sapphireForEach(array, callback):
    if not isinstance(array, list):
        raise RuntimeError("SIMULATION_REFERENCE")
    for element in list(array):
        callback(element)

# Refuse un résultat non fini, comme le modèle numérique Sapphire.
def sapphireFinite(value):
    if not _sapphireMath.isfinite(value):
        raise RuntimeError("SIMULATION_MATH_DOMAIN")
    return value

# Opérations entières natives qui n'ont pas d'équivalent direct strict.
def sapphireClamp(value, lower, upper):
    return lower if value < lower else upper if value > upper else value

def sapphireSign(value):
    return -1 if value < 0 else 1 if value > 0 else 0

def sapphireLerp(start, end, ratio):
    return sapphireFinite(start + (end - start) * ratio)

# Indices et portions de texte en scalaires Unicode, avec refus des bornes invalides.
def sapphireCharAt(value, index):
    if index < 0 or index >= len(value):
        raise RuntimeError("SIMULATION_STRING_BOUNDS")
    return value[index]

def sapphireSubstring(value, start, end):
    if start < 0 or start > end or end > len(value):
        raise RuntimeError("SIMULATION_STRING_BOUNDS")
    return value[start:end]

def sapphireArraySlice(value, start, end):
    if not isinstance(value, list):
        raise RuntimeError("SIMULATION_REFERENCE")
    if start < 0 or start > end or end > len(value):
        raise RuntimeError("SIMULATION_ARRAY_BOUNDS")
    return value[start:end]

def sapphireArrayIndexOf(value, search):
    if not isinstance(value, list):
        raise RuntimeError("SIMULATION_REFERENCE")
    try:
        return value.index(search)
    except ValueError:
        return -1

# Logarithmes, racines et puissances ramenés au code de domaine Sapphire.
def sapphireLog(value):
    if value <= 0:
        raise RuntimeError("SIMULATION_MATH_DOMAIN")
    return _sapphireMath.log(value)

def sapphireSqrt(value):
    if value < 0:
        raise RuntimeError("SIMULATION_MATH_DOMAIN")
    return _sapphireMath.sqrt(value)

def sapphirePow(base, exponent):
    try:
        return sapphireFinite(_sapphireMath.pow(base, exponent))
    except (ValueError, OverflowError):
        raise RuntimeError("SIMULATION_MATH_DOMAIN") from None

# Arrondis double, avec le même comportement que Math.floor/ceil/round en JavaScript.
def sapphireFloor(value):
    return float(_sapphireMath.floor(value))

def sapphireCeil(value):
    return float(_sapphireMath.ceil(value))

def sapphireRound(value):
    if value == 0: return value
    if -0.5 <= value < 0: return -0.0
    return float(_sapphireMath.floor(value + 0.5))

# Conserve les sorties scalaires Sapphire : booléens minuscules, zéros, tableaux et notation décimale.
def sapphireFormat(value):
    if isinstance(value, bool): return "true" if value else "false"
    if isinstance(value, list): return "[" + ", ".join(sapphireFormat(element) for element in value) + "]"
    if not isinstance(value, float): return str(value)
    if value == 0: return "0"
    text = repr(value)
    if "e" not in text:
        return text[:-2] if text.endswith(".0") else text
    mantissa, exponent_text = text.split("e")
    exponent = int(exponent_text)
    if 1e-6 <= abs(value) < 1e21:
        unsigned = mantissa.lstrip("-")
        digits = unsigned.replace(".", "")
        point = (unsigned.index(".") if "." in unsigned else len(unsigned)) + exponent
        if point <= 0: result = "0." + "0" * -point + digits
        elif point >= len(digits): result = digits + "0" * (point - len(digits))
        else: result = digits[:point] + "." + digits[point:]
        if "." in result: result = result.rstrip("0").rstrip(".")
        return ("-" if value < 0 else "") + result
    if mantissa.endswith(".0"): mantissa = mantissa[:-2]
    return mantissa + "e" + ("+" if exponent >= 0 else "-") + str(abs(exponent))
`
}
