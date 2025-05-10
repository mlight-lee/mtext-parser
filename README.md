# AutoCAD MText Parser

TypeScript version of AutoCAD MText parser. It is based on [ezdxf dxf mtext parser](https://github.com/mozman/ezdxf/blob/aaa2d1b302c78a47fe1159bd6007254d1c2ebd22/src/ezdxf/tools/text.py) and ported by [Cursor](https://www.cursor.com/). Moveover, unit tests are added based on use case in the  specification in next section.

## AutoCAD MText Specification

The text formatting is done by inline codes. You can get more information from [this page](https://ezdxf.mozman.at/docs/dxfinternals/entities/mtext.html).

### caret encoded characters:
- “^I” tabulator
- “^J” (LF) is a valid line break like “\P”
- “^M” (CR) is ignored
- other characters render as empty square “▯”
- a space “ “ after the caret renders the caret glyph: “1^ 2” renders “1^2”

### special encoded characters:
- “%%c” and “%%C” renders “Ø” (alt-0216)
- “%%d” and “%%D” renders “°” (alt-0176)
- “%%p” and “%%P” renders “±” (alt-0177)

### Alignment command “\A”: argument “0”, “1” or “2” is expected
- the terminator symbol “;” is optional
- the arguments “3”, “4”, “5”, “6”, “7”, “8”, “9” and “-” default to 0
- other characters terminate the command and will be printed: “\AX”, renders “X”

### ACI color command “\C”: int argument is expected
- the terminator symbol “;” is optional
- a leading “-” or “+” terminates the command, “\C+5” renders “\C+5”
- arguments > 255, are ignored but consumed “\C1000” renders nothing, not even a “0”
- a trailing “;” after integers is always consumed, even for much to big values, “\C10000;” renders nothing

### RGB color command “\c”: int argument is expected
- the terminator symbol “;” is optional
- a leading “-” or “+” terminates the command, “\c+255” renders “\c+255”
- arguments >= 16777216 are masked by: value & 0xFFFFFF
- a trailing “;” after integers is always consumed, even for much to big values, “\c9999999999;” renders nothing and switches the color to yellow (255, 227, 11)

### Height command “\H” and “\H…x”: float argument is expected
- the terminator symbol “;” is optional
- a leading “-” is valid, but negative values are ignored
- a leading “+” is valid
- a leading “.” is valid like “\H.5x” for height factor 0.5
- exponential format is valid like “\H1e2” for height factor 100 and “\H1e-2” for 0.01
- an invalid floating point value terminates the command, “\H1..5” renders “\H1..5”

### Other commands with floating point arguments like the height command:
- Width commands “\W” and “\W…x”
- Character tracking commands “\T” and “\T…x”, negative values are used
- Slanting (oblique) command “\Q”

### Stacking command “\S”:
- build fractions: “numerator (upr)” + “stacking type char (t)” + “denominator (lwr)” + “;”
- divider chars: “^”, “/” or “#”
- a space “ “ after the divider char “^” is mandatory to avoid caret decoding: “\S1^ 2;”
- the terminator symbol “;” is mandatory to end the command, all chars beyond the “\S” until the next “;” or the end of the string are part of the fraction
- backslash escape “\;” to render the terminator char
- a space “ “ after the divider chars “/” and “#” is rendered as space “ ” in front of the denominator
- the numerator and denominator can contain spaces
- backslashes “\” inside the stacking command are ignored (except “\;”) “\S\N^ \P” render “N” over “P”, therefore property changes (color, text height, …) are not possible inside the stacking command
- grouping chars “{” and “}” render as simple curly braces
- caret encoded chars are decoded “^I”, “^J”, “^M”, but render as a simple space “ “ or as the replacement char “▯” plus a space
- a divider char after the first divider char, renders as the char itself: “\S1/2/3” renders the horizontal fraction “1” / “2/3”

### Font command “\f” and “\F”: export only “\f”, parse both, “\F” ignores some arguments
- the terminator symbol “;” is mandatory to end the command, all chars beyond the “\f” until the next “;” or the end of the string are part of the command
- the command arguments are separated by the pipe char “|”
- arguments: “font family name” | “bold” | “italic” | “codepage” | “pitch”; example “\fArial|b0|i0|c0|p0;”
- only the “font family name” argument is required, fonts which are not available on the system are replaced by the “TXT.SHX” shape font
- the “font family name” is the font name shown in font selection widgets in desktop applications
- “b1” to use the bold font style, any other second char is interpreted as “non bold”
- “i1” to use an italic font style, any other second char is interpreted as “non italic”
- “c???” change codepage, “c0” use the default codepage, because of the age of unicode no further investigations, also seems to be ignored by AutoCAD and BricsCAD
- “p???” change pitch size, “p0” means don’t change, ignored by AutoCAD and BricsCAD, to change the text height use the “\H” command
- the order is not important, but export always in the shown order: “\fArial|b0|i0;” the arguments “c0” and “p0” are not required

### Paragraph properties command “\p”
- the terminator symbol “;” is mandatory to end the command, all chars beyond the “\p” until the next “;” or the end of the string are part of the command
- the command arguments are separated by commas “,”
- all values are factors for the initial char height of the MTEXT entity, example: char height = 2.5, “\pl1;” set the left paragraph indentation to 1 x 2.5 = 2.5 drawing units.
- all values are floating point values, see height command
- arguments are “i”, “l”, “r”, “q”, “t”
- a “*” as argument value, resets the argument to the initial value: “i0”, “l0”, “r0”, the “q” argument most likely depends on the text direction; I haven’t seen “t*”. The sequence used by BricsCAD to reset all values is "\pi*,l*,r*,q*,t;"
- “i” indentation of the first line relative to the “l” argument as floating point value, “\pi1.5”
- “l” left paragraph indentation as floating point value, “\pl1.5”
- “r” right paragraph indentation as floating point value, “\pr1.5”
- “x” is required if a “q” or a “t” argument is present, the placement of the “x” has no obvious rules
- “q” paragraph alignment
  - “ql” left paragraph alignment
  - “qr” right paragraph alignment
  - “qc” center paragraph alignment
  - “qj” justified paragraph alignment
  - “qd” distributed paragraph alignment
- “t” tabulator stops as comma separated list, the default tabulator stops are located at 4, 8, 12, …, by defining at least one tabulator stop, the default tabulator stops will be ignored. There 3 kind of tabulator stops: left, right and center adjusted stops, e.g. “pxt1,r5,c8”:
  - a left adjusted stop has no leading char, two left adjusted stops “\pxt1,2;”
  - a right adjusted stop has a preceding “r” char, “\pxtr1,r2;”
  - a center adjusted stop has a preceding “c” char, “\pxtc1,c2;”

- complex example to create a numbered list with two items: "pxi-3,l4t4;1.^Ifirst item\P2.^Isecond item"
- a parser should be very flexible, I have seen several different orders of the arguments and placing the sometimes required “x” has no obvious rules.
- exporting seems to be safe to follow these three rules:
  - the command starts with "\\px", the "x" does no harm, if not required
  - argument order "i", "l", "r", "q", "t", any of the arguments can be left off
  - terminate the command with a ";"

## Usage

```bash
npm install @mlightcad/libredwg-web
```

Here's how to use the MText parser in your TypeScript/JavaScript project:

```typescript
import { MTextParser, TokenType } from '@mlightcad/mtext-parser';

// Basic usage
const parser = new MTextParser('Hello World');
const tokens = Array.from(parser.parse());
// tokens will contain:
// - WORD token with "Hello"
// - SPACE token
// - WORD token with "World"

// Parsing formatted text
const formattedParser = new MTextParser('\\H2.5;Large\\H.5x;Small');
const formattedTokens = Array.from(formattedParser.parse());
// formattedTokens will contain:
// - WORD token with "Large" and capHeight = 2.5
// - WORD token with "Small" and capHeight = 0.5

// Parsing special characters
const specialParser = new MTextParser('Diameter: %%c, Angle: %%d, Tolerance: %%p');
const specialTokens = Array.from(specialParser.parse());
// specialTokens will contain:
// - WORD token with "Diameter: Ø, Angle: °, Tolerance: ±"

// Parsing with context
const ctx = new MTextContext();
ctx.capHeight = 2.0;
ctx.widthFactor = 1.5;
const contextParser = new MTextParser('Text with context', ctx);
const contextTokens = Array.from(contextParser.parse());
// contextTokens will contain tokens with the specified context

// Parsing with property commands
const propertyParser = new MTextParser('\\C1;Red Text', undefined, true);
const propertyTokens = Array.from(propertyParser.parse());
// propertyTokens will contain:
// - PROPERTIES_CHANGED token with the color command
// - WORD token with "Red Text" and aci = 1
```

### Token Types

The parser produces tokens of the following types:

- `WORD`: Text content with associated formatting context
- `SPACE`: Space character
- `NBSP`: Non-breaking space
- `TABULATOR`: Tab character
- `NEW_PARAGRAPH`: Paragraph break
- `NEW_COLUMN`: Column break
- `WRAP_AT_DIMLINE`: Wrap at dimension line
- `STACK`: Stacked fraction with [numerator, denominator, type] data
- `PROPERTIES_CHANGED`: Property change command (only when yieldPropertyCommands is true)

### Context Properties

Each token includes a context object (`MTextContext`) that contains the current formatting state:

- `underline`: Whether text is underlined
- `overline`: Whether text has overline
- `strikeThrough`: Whether text has strike-through
- `aci`: ACI color value (0-256)
- `rgb`: RGB color value [r, g, b]
- `align`: Line alignment (BOTTOM, MIDDLE, TOP)
- `fontFace`: Font properties (family, style, weight)
- `capHeight`: Capital letter height
- `widthFactor`: Character width factor
- `charTrackingFactor`: Character tracking factor
- `oblique`: Oblique angle
- `paragraph`: Paragraph properties (indent, margins, alignment, tab stops)

### Error Handling

The parser handles invalid commands gracefully:

- Invalid floating point values are treated as literal text
- Invalid special character codes are ignored
- Invalid property commands are treated as literal text
- Invalid stacking commands are treated as literal text

This makes the parser robust for handling real-world MText content that may contain errors or unexpected formatting.