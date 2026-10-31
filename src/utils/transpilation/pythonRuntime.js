import { primitiveDefinitions } from '../logic/primitives.js'
import { diagnosticCodes } from '../logic/diagnostics.js'

export const pythonRuntimeNames = [
  '_sapphireMath', '_sapphireStruct', '_sapphireTypes', '_sapphireCodes',
  'sapphireUninitialized', 'sapphireRead', 'sapphireCheck', 'sapphireBinary',
  'sapphireUnary', 'sapphireCast', 'sapphireFormat', 'sapphireQuotient',
  'print', 'object', 'isinstance', 'bool', 'int', 'float', 'str', 'repr', 'abs', 'len', 'RuntimeError', 'OverflowError',
]

// Embarque uniquement l'adaptation runtime Python, alimentée par les bornes/codes du moteur commun.
export function pythonRuntime() {
  const types = Object.fromEntries(Object.entries(primitiveDefinitions).map(([name, definition]) => [name, { category: definition.category, bits: definition.bits, min: definition.min, max: definition.max }]))
  return `# Contrôles Sapphire : bornes et codes issus du moteur commun.
import math as _sapphireMath
import struct as _sapphireStruct

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

# Conserve les sorties scalaires Sapphire : booléens minuscules, zéros et notation décimale.
def sapphireFormat(value):
    if isinstance(value, bool): return "true" if value else "false"
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
