/**
 * Token types used in MText parsing
 */
export enum TokenType {
  /** No token */
  NONE = 0,
  /** Word token with string data */
  WORD = 1,
  /** Stack token with [numerator, denominator, type] data */
  STACK = 2,
  /** Space token with no data */
  SPACE = 3,
  /** Non-breaking space token with no data */
  NBSP = 4,
  /** Tab token with no data */
  TABULATOR = 5,
  /** New paragraph token with no data */
  NEW_PARAGRAPH = 6,
  /** New column token with no data */
  NEW_COLUMN = 7,
  /** Wrap at dimension line token with no data */
  WRAP_AT_DIMLINE = 8,
  /** Properties changed token with string data (full command) */
  PROPERTIES_CHANGED = 9,
}

/**
 * Line alignment options for MText
 */
export enum MTextLineAlignment {
  /** Align text to bottom */
  BOTTOM = 0,
  /** Align text to middle */
  MIDDLE = 1,
  /** Align text to top */
  TOP = 2,
}

/**
 * Paragraph alignment options for MText
 */
export enum MTextParagraphAlignment {
  /** Default alignment */
  DEFAULT = 0,
  /** Left alignment */
  LEFT = 1,
  /** Right alignment */
  RIGHT = 2,
  /** Center alignment */
  CENTER = 3,
  /** Justified alignment */
  JUSTIFIED = 4,
  /** Distributed alignment */
  DISTRIBUTED = 5,
}

/**
 * Text stroke options for MText
 */
export enum MTextStroke {
  /** No stroke */
  NONE = 0,
  /** Underline stroke */
  UNDERLINE = 1,
  /** Overline stroke */
  OVERLINE = 2,
  /** Strike-through stroke */
  STRIKE_THROUGH = 4,
}

/**
 * RGB color tuple
 */
export type RGB = [number, number, number];

/**
 * Font face properties
 */
export interface FontFace {
  /** Font family name */
  family: string;
  /** Font style (e.g., 'Regular', 'Italic') */
  style: string;
  /** Font weight (e.g., 400 for normal, 700 for bold) */
  weight: number;
}

/**
 * Font measurement properties
 */
export interface FontMeasurements {
  /** Height of capital letters */
  cap_height: number;
  /** Baseline position */
  baseline: number;
  /** Bottom position */
  bottom: number;
  /** Top position */
  top: number;
  /** Total height of the font */
  total_height: number;
  /**
   * Scale measurements by a factor
   * @param factor - The scaling factor
   * @returns New scaled measurements
   */
  scale(factor: number): FontMeasurements;
}

/**
 * Abstract font interface
 */
export interface AbstractFont {
  /**
   * Calculate text width
   * @param text - The text to measure
   * @returns Width of the text
   */
  text_width(text: string): number;
  /**
   * Get width of a space character
   * @returns Width of a space
   */
  space_width(): number;
  /** Font measurements */
  measurements: FontMeasurements;
}

/**
 * Paragraph properties
 */
export interface ParagraphProperties {
  /** Indentation value */
  indent: number;
  /** Left margin value */
  left: number;
  /** Right margin value */
  right: number;
  /** Paragraph alignment */
  align: MTextParagraphAlignment;
  /** Tab stop positions and types */
  tab_stops: (number | string)[];
}

/**
 * Special character encoding mapping
 */
const SPECIAL_CHAR_ENCODING: Record<string, string> = {
  c: 'Ø',
  d: '°',
  p: '±',
};

/**
 * Character to paragraph alignment mapping
 */
const CHAR_TO_ALIGN: Record<string, MTextParagraphAlignment> = {
  l: MTextParagraphAlignment.LEFT,
  r: MTextParagraphAlignment.RIGHT,
  c: MTextParagraphAlignment.CENTER,
  j: MTextParagraphAlignment.JUSTIFIED,
  d: MTextParagraphAlignment.DISTRIBUTED,
};

/**
 * Convert RGB tuple to integer color value
 * @param rgb - RGB color tuple
 * @returns Integer color value
 */
export function rgb2int(rgb: RGB): number {
  const [r, g, b] = rgb;
  return (b << 16) | (g << 8) | r;
}

/**
 * Convert integer color value to RGB tuple
 * @param value - Integer color value
 * @returns RGB color tuple
 */
export function int2rgb(value: number): RGB {
  const r = value & 0xff;
  const g = (value >> 8) & 0xff;
  const b = (value >> 16) & 0xff;
  return [r, g, b];
}

/**
 * DXF stores some special characters using caret notation. This function
 * decodes this notation to normalize the representation of special characters
 * in the string.
 * see: https://en.wikipedia.org/wiki/Caret_notation
 * @param text - Text to decode
 * @returns Decoded text
 */
export function caretDecode(text: string): string {
  return text.replace(/\^(.)/g, (_, c) => {
    const code = c.charCodeAt(0);

    // Handle space after caret
    if (code === 32) {
      // Space
      return '^';
    }

    // Handle control characters
    if (code === 73) {
      // Tab (^I)
      return '\t';
    }
    if (code === 74) {
      // Line Feed (^J)
      return '\n';
    }
    if (code === 77) {
      // Carriage Return (^M)
      return '';
    }

    // Handle all other characters
    return '▯';
  });
}

/**
 * Escape DXF line endings
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeDxfLineEndings(text: string): string {
  return text.replace(/\r\n|\r|\n/g, '\\P');
}

/**
 * Check if text contains inline formatting codes
 * @param text - Text to check
 * @returns True if text contains formatting codes
 */
export function hasInlineFormattingCodes(text: string): boolean {
  return text.replace(/\\P/g, '').replace(/\\~/g, '').includes('\\');
}

/**
 * Main parser class for MText content
 */
export class MTextParser {
  private scanner: TextScanner;
  private ctx: MTextContext;
  private ctxStack: MTextContext[] = [];
  private continueStroke: boolean = false;
  private yieldPropertyCommands: boolean;

  /**
   * Creates a new MTextParser instance
   * @param content - The MText content to parse
   * @param ctx - Optional initial MText context
   * @param yieldPropertyCommands - Whether to yield property change commands
   */
  constructor(content: string, ctx?: MTextContext, yieldPropertyCommands: boolean = false) {
    this.scanner = new TextScanner(caretDecode(content));
    this.ctx = ctx || new MTextContext();
    this.yieldPropertyCommands = yieldPropertyCommands;
  }

  /**
   * Push current context onto the stack
   */
  private pushCtx(): void {
    this.ctxStack.push(this.ctx);
  }

  /**
   * Pop context from the stack
   */
  private popCtx(): void {
    if (this.ctxStack.length > 0) {
      this.ctx = this.ctxStack.pop()!;
    }
  }

  /**
   * Parse stacking expression (numerator/denominator)
   * @returns Tuple of [TokenType.STACK, [numerator, denominator, type]]
   */
  private parseStacking(): [TokenType, [string, string, string]] {
    const scanner = new TextScanner(this.extractExpression(true));
    let numerator = '';
    let denominator = '';
    let stackingType = '';

    const getNextChar = (): [string, boolean] => {
      let c = scanner.peek();
      let escape = false;
      if (c.charCodeAt(0) < 32) {
        c = ' ';
      }
      if (c === '\\') {
        escape = true;
        scanner.consume(1);
        c = scanner.peek();
      }
      scanner.consume(1);
      return [c, escape];
    };

    const parseNumerator = (): [string, string] => {
      let word = '';
      while (scanner.hasData) {
        const [c, escape] = getNextChar();
        if (!escape && '^/#'.includes(c)) {
          return [word, c];
        }
        word += c;
      }
      return [word, ''];
    };

    const parseDenominator = (): string => {
      let word = '';
      while (scanner.hasData) {
        const [c, escape] = getNextChar();
        if (escape && c === ';') {
          word += ';';
        } else {
          word += c;
        }
      }
      return word;
    };

    [numerator, stackingType] = parseNumerator();
    if (stackingType) {
      denominator = parseDenominator();
    }

    return [TokenType.STACK, [numerator, denominator, stackingType]];
  }

  /**
   * Parse MText properties
   * @param cmd - The property command to parse
   */
  private parseProperties(cmd: string): void {
    const newCtx = this.ctx.copy();

    switch (cmd) {
      case 'L':
        newCtx.underline = true;
        this.continueStroke = true;
        break;
      case 'l':
        newCtx.underline = false;
        if (!newCtx.hasAnyStroke) {
          this.continueStroke = false;
        }
        break;
      case 'O':
        newCtx.overline = true;
        this.continueStroke = true;
        break;
      case 'o':
        newCtx.overline = false;
        if (!newCtx.hasAnyStroke) {
          this.continueStroke = false;
        }
        break;
      case 'K':
        newCtx.strikeThrough = true;
        this.continueStroke = true;
        break;
      case 'k':
        newCtx.strikeThrough = false;
        if (!newCtx.hasAnyStroke) {
          this.continueStroke = false;
        }
        break;
      case 'A':
        this.parseAlign(newCtx);
        break;
      case 'C':
        this.parseAciColor(newCtx);
        break;
      case 'c':
        this.parseRgbColor(newCtx);
        break;
      case 'H':
        this.parseHeight(newCtx);
        break;
      case 'W':
        this.parseWidth(newCtx);
        break;
      case 'Q':
        this.parseOblique(newCtx);
        break;
      case 'T':
        this.parseCharTracking(newCtx);
        break;
      case 'p':
        this.parseParagraphProperties(newCtx);
        break;
      case 'f':
      case 'F':
        this.parseFontProperties(newCtx);
        break;
      default:
        throw new Error(`Unknown command: ${cmd}`);
    }

    newCtx.continueStroke = this.continueStroke;
    this.ctx = newCtx;
  }

  /**
   * Parse alignment property
   * @param ctx - The context to update
   */
  private parseAlign(ctx: MTextContext): void {
    const char = this.scanner.get();
    if ('012'.includes(char)) {
      ctx.align = parseInt(char) as MTextLineAlignment;
    } else {
      ctx.align = MTextLineAlignment.BOTTOM;
    }
    this.consumeOptionalTerminator();
  }

  /**
   * Parse height property
   * @param ctx - The context to update
   */
  private parseHeight(ctx: MTextContext): void {
    const expr = this.extractFloatExpression(true);
    if (expr) {
      try {
        if (expr.endsWith('x')) {
          // For height command, treat x suffix as absolute value
          ctx.capHeight = Math.abs(parseFloat(expr.slice(0, -1)));
        } else {
          ctx.capHeight = Math.abs(parseFloat(expr));
        }
      } catch (e) {
        // If parsing fails, treat the entire command as literal text
        this.scanner.consume(-expr.length); // Rewind to before the expression
        return;
      }
    }
    this.consumeOptionalTerminator();
  }

  /**
   * Parse width property
   * @param ctx - The context to update
   */
  private parseWidth(ctx: MTextContext): void {
    const expr = this.extractFloatExpression(true);
    if (expr) {
      try {
        if (expr.endsWith('x')) {
          // For width command, treat x suffix as absolute value
          ctx.widthFactor = Math.abs(parseFloat(expr.slice(0, -1)));
        } else {
          ctx.widthFactor = Math.abs(parseFloat(expr));
        }
      } catch (e) {
        // If parsing fails, treat the entire command as literal text
        this.scanner.consume(-expr.length); // Rewind to before the expression
        return;
      }
    }
    this.consumeOptionalTerminator();
  }

  /**
   * Parse character tracking property
   * @param ctx - The context to update
   */
  private parseCharTracking(ctx: MTextContext): void {
    const expr = this.extractFloatExpression(true);
    if (expr) {
      try {
        if (expr.endsWith('x')) {
          // For tracking command, treat x suffix as absolute value
          ctx.charTrackingFactor = Math.abs(parseFloat(expr.slice(0, -1)));
        } else {
          ctx.charTrackingFactor = Math.abs(parseFloat(expr));
        }
      } catch (e) {
        // If parsing fails, treat the entire command as literal text
        this.scanner.consume(-expr.length); // Rewind to before the expression
        return;
      }
    }
    this.consumeOptionalTerminator();
  }

  /**
   * Parse float value or factor
   * @param value - Current value to apply factor to
   * @returns New value
   */
  private parseFloatValueOrFactor(value: number): number {
    const expr = this.extractFloatExpression(true);
    if (expr) {
      if (expr.endsWith('x')) {
        const factor = parseFloat(expr.slice(0, -1));
        value *= Math.abs(factor);
      } else {
        value = Math.abs(parseFloat(expr));
      }
    }
    return value;
  }

  /**
   * Parse oblique angle property
   * @param ctx - The context to update
   */
  private parseOblique(ctx: MTextContext): void {
    const obliqueExpr = this.extractFloatExpression(false);
    if (obliqueExpr) {
      ctx.oblique = parseFloat(obliqueExpr);
    }
    this.consumeOptionalTerminator();
  }

  /**
   * Parse ACI color property
   * @param ctx - The context to update
   */
  private parseAciColor(ctx: MTextContext): void {
    const aciExpr = this.extractIntExpression();
    if (aciExpr) {
      const aci = parseInt(aciExpr);
      if (aci < 257) {
        ctx.aci = aci;
        ctx.rgb = null;
      }
    }
    this.consumeOptionalTerminator();
  }

  /**
   * Parse RGB color property
   * @param ctx - The context to update
   */
  private parseRgbColor(ctx: MTextContext): void {
    const rgbExpr = this.extractIntExpression();
    if (rgbExpr) {
      const value = parseInt(rgbExpr) & 0xffffff;
      const [b, g, r] = int2rgb(value);
      ctx.rgb = [r, g, b];
    }
    this.consumeOptionalTerminator();
  }

  /**
   * Extract float expression from scanner
   * @param relative - Whether to allow relative values (ending in 'x')
   * @returns Extracted expression
   */
  private extractFloatExpression(relative: boolean = false): string {
    const pattern = relative
      ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?x?/
      : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
    const match = this.scanner.tail.match(pattern);
    if (match) {
      const result = match[0];
      this.scanner.consume(result.length);
      return result;
    }
    return '';
  }

  /**
   * Extract integer expression from scanner
   * @returns Extracted expression
   */
  private extractIntExpression(): string {
    const match = this.scanner.tail.match(/^\d+/);
    if (match) {
      const result = match[0];
      this.scanner.consume(result.length);
      return result;
    }
    return '';
  }

  /**
   * Extract expression until semicolon or end
   * @param escape - Whether to handle escaped semicolons
   * @returns Extracted expression
   */
  private extractExpression(escape: boolean = false): string {
    const stop = this.scanner.find(';', escape);
    if (stop < 0) {
      const expr = this.scanner.tail;
      this.scanner.consume(expr.length);
      return expr;
    }
    // Check if the semicolon is escaped by looking at the previous character
    const prevChar = this.scanner.peek(stop - this.scanner.currentIndex - 1);
    const isEscaped = prevChar === '\\';
    const expr = this.scanner.tail.slice(0, stop - this.scanner.currentIndex + (isEscaped ? 1 : 0));
    this.scanner.consume(expr.length + 1);
    return expr;
  }

  /**
   * Parse font properties
   * @param ctx - The context to update
   */
  private parseFontProperties(ctx: MTextContext): void {
    const parts = this.extractExpression().split('|');
    if (parts.length > 0 && parts[0]) {
      const name = parts[0];
      let style = 'Regular';
      let weight = 400;

      for (const part of parts.slice(1)) {
        if (part.startsWith('b1')) {
          weight = 700;
        } else if (part.startsWith('i1')) {
          style = 'Italic';
        }
      }

      ctx.fontFace = {
        family: name,
        style,
        weight,
      };
    }
  }

  /**
   * Parse paragraph properties from the MText content
   * Handles properties like indentation, alignment, and tab stops
   * @param ctx - The context to update
   */
  private parseParagraphProperties(ctx: MTextContext): void {
    const scanner = new TextScanner(this.extractExpression());
    /** Current indentation value */
    let indent = ctx.paragraph.indent;
    /** Left margin value */
    let left = ctx.paragraph.left;
    /** Right margin value */
    let right = ctx.paragraph.right;
    /** Current paragraph alignment */
    let align = ctx.paragraph.align;
    /** Array of tab stop positions and types */
    let tabStops: (number | string)[] = [];

    /**
     * Parse a floating point number from the scanner's current position
     * Handles optional sign, decimal point, and scientific notation
     * @returns The parsed float value, or 0 if no valid number is found
     */
    const parseFloatValue = (): number => {
      const match = scanner.tail.match(/^[+-]?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/);
      if (match) {
        const value = parseFloat(match[0]);
        scanner.consume(match[0].length);
        while (scanner.peek() === ',') {
          scanner.consume(1);
        }
        return value;
      }
      return 0;
    };

    while (scanner.hasData) {
      const cmd = scanner.get();
      switch (cmd) {
        case 'i': // Indentation
          indent = parseFloatValue();
          break;
        case 'l': // Left margin
          left = parseFloatValue();
          break;
        case 'r': // Right margin
          right = parseFloatValue();
          break;
        case 'x': // Skip
          break;
        case 'q': // Alignment
          const adjustment = scanner.get();
          align = CHAR_TO_ALIGN[adjustment] || MTextParagraphAlignment.DEFAULT;
          while (scanner.peek() === ',') {
            scanner.consume(1);
          }
          break;
        case 't': // Tab stops
          tabStops = [];
          while (scanner.hasData) {
            const type = scanner.peek();
            if (type === 'r' || type === 'c') {
              scanner.consume(1);
              const value = parseFloatValue();
              tabStops.push(type + value.toString());
            } else {
              const value = parseFloatValue();
              if (!isNaN(value)) {
                tabStops.push(value);
              } else {
                scanner.consume(1);
              }
            }
          }
          break;
      }
    }

    ctx.paragraph = {
      indent,
      left,
      right,
      align,
      tab_stops: tabStops,
    };
  }

  /**
   * Consume optional terminator (semicolon)
   */
  private consumeOptionalTerminator(): void {
    if (this.scanner.peek() === ';') {
      this.scanner.consume(1);
    }
  }

  /**
   * Parse MText content into tokens
   * @yields MTextToken objects
   */
  *parse(): Generator<MTextToken> {
    let wordToken = TokenType.WORD;
    let spaceToken = TokenType.SPACE;
    let followupToken: TokenType | null = null;

    const wordAndToken = (word: string, token: TokenType): [TokenType, string] => {
      if (word) {
        followupToken = token;
        return [wordToken, word];
      }
      return [token, ''];
    };

    const nextToken = (): [TokenType, any] => {
      let word = '';
      while (this.scanner.hasData) {
        let escape = false;
        let letter = this.scanner.peek();
        const cmdStartIndex = this.scanner.currentIndex;

        if (letter === '\\') {
          if ('\\{}'.includes(this.scanner.peek(1))) {
            escape = true;
            this.scanner.consume(1);
            letter = this.scanner.peek();
          } else {
            if (word) {
              return [wordToken, word];
            }
            this.scanner.consume(1);
            const cmd = this.scanner.get();
            switch (cmd) {
              case '~':
                return [TokenType.NBSP, null];
              case 'P':
                return [TokenType.NEW_PARAGRAPH, null];
              case 'N':
                return [TokenType.NEW_COLUMN, null];
              case 'X':
                return [TokenType.WRAP_AT_DIMLINE, null];
              case 'S':
                return this.parseStacking();
              default:
                if (cmd) {
                  try {
                    this.parseProperties(cmd);
                    if (this.yieldPropertyCommands) {
                      return [
                        TokenType.PROPERTIES_CHANGED,
                        this.scanner.tail.slice(cmdStartIndex, this.scanner.currentIndex),
                      ];
                    }
                    // After processing a property command, continue with normal parsing
                    continue;
                  } catch (e) {
                    const commandText = this.scanner.tail.slice(cmdStartIndex, this.scanner.currentIndex);
                    word += commandText;
                  }
                }
            }
            continue;
          }
        }

        if (letter.charCodeAt(0) < 32) {
          if (letter === '\t') {
            return wordAndToken(word, TokenType.TABULATOR);
          }
          if (letter === '\n') {
            return wordAndToken(word, TokenType.NEW_PARAGRAPH);
          }
          letter = ' ';
        } else if (letter === '%' && this.scanner.peek(1) === '%') {
          const code = this.scanner.peek(2).toLowerCase();
          const specialChar = SPECIAL_CHAR_ENCODING[code];
          if (specialChar) {
            this.scanner.consume(3);
            word += specialChar;
            continue;
          } else {
            // Skip invalid special character codes
            this.scanner.consume(3);
            continue;
          }
        }

        if (letter === ' ') {
          if (word) {
            this.scanner.consume(1);
            followupToken = spaceToken;
            return [wordToken, word];
          }
          this.scanner.consume(1);
          return [spaceToken, null];
        }

        if (!escape) {
          if (letter === '{') {
            if (word) {
              return [wordToken, word];
            }
            this.scanner.consume(1);
            this.pushCtx();
            continue;
          } else if (letter === '}') {
            if (word) {
              return [wordToken, word];
            }
            this.scanner.consume(1);
            this.popCtx();
            continue;
          }
        }

        this.scanner.consume(1);
        if (letter.charCodeAt(0) >= 32) {
          word += letter;
        }
      }

      if (word) {
        return [wordToken, word];
      }
      return [TokenType.NONE, null];
    };

    while (true) {
      const [type, data] = nextToken();
      if (type) {
        yield new MTextToken(type, this.ctx, data);
        if (followupToken) {
          yield new MTextToken(followupToken, this.ctx, null);
          followupToken = null;
        }
      } else {
        break;
      }
    }
  }
}

/**
 * Text scanner for parsing MText content
 */
export class TextScanner {
  private text: string;
  private textLen: number;
  private _index: number;

  /**
   * Create a new text scanner
   * @param text - The text to scan
   */
  constructor(text: string) {
    this.text = text;
    this.textLen = text.length;
    this._index = 0;
  }

  /**
   * Get the current index in the text
   */
  get currentIndex(): number {
    return this._index;
  }

  /**
   * Check if the scanner has reached the end of the text
   */
  get isEmpty(): boolean {
    return this._index >= this.textLen;
  }

  /**
   * Check if there is more text to scan
   */
  get hasData(): boolean {
    return this._index < this.textLen;
  }

  /**
   * Get the next character and advance the index
   * @returns The next character, or empty string if at end
   */
  get(): string {
    if (this.isEmpty) {
      return '';
    }
    const char = this.text[this._index];
    this._index++;
    return char;
  }

  /**
   * Advance the index by the specified count
   * @param count - Number of characters to advance
   */
  consume(count: number = 1): void {
    if (count < 1) throw new Error(`Invalid consume count: ${count}`);
    this._index = Math.min(this._index + count, this.textLen);
  }

  /**
   * Look at a character without advancing the index
   * @param offset - Offset from current position
   * @returns The character at the offset position, or empty string if out of bounds
   */
  peek(offset: number = 0): string {
    if (offset < 0) throw new Error(`Invalid peek offset: ${offset}`);
    const index = this._index + offset;
    if (index >= this.textLen) {
      return '';
    }
    return this.text[index];
  }

  /**
   * Find the next occurrence of a character
   * @param char - The character to find
   * @param escape - Whether to handle escaped characters
   * @returns Index of the character, or -1 if not found
   */
  find(char: string, escape: boolean = false): number {
    let index = this._index;
    while (index < this.textLen) {
      if (escape && this.text[index] === '\\') {
        if (index + 1 < this.textLen) {
          if (this.text[index + 1] === char) {
            return index + 1;
          }
          index += 2;
          continue;
        }
        index++;
        continue;
      }
      if (this.text[index] === char) {
        return index;
      }
      index++;
    }
    return -1;
  }

  /**
   * Get the remaining text from the current position
   */
  get tail(): string {
    return this.text.slice(this._index);
  }

  /**
   * Check if the next character is a space
   */
  isNextSpace(): boolean {
    return this.peek() === ' ';
  }

  /**
   * Consume spaces until a non-space character is found
   * @returns Number of spaces consumed
   */
  consumeSpaces(): number {
    let count = 0;
    while (this.isNextSpace()) {
      this.consume();
      count++;
    }
    return count;
  }
}

/**
 * MText context class for managing text formatting state
 */
export class MTextContext {
  private _stroke: number = 0;
  /** Whether to continue stroke formatting */
  continueStroke: boolean = false;
  private _aci: number = 7;
  /** RGB color value, or null if using ACI */
  rgb: RGB | null = null;
  /** Line alignment */
  align: MTextLineAlignment = MTextLineAlignment.BOTTOM;
  /** Font face properties */
  fontFace: FontFace = { family: '', style: 'Regular', weight: 400 };
  /** Capital letter height */
  capHeight: number = 1.0;
  /** Character width factor */
  widthFactor: number = 1.0;
  /** Character tracking factor */
  charTrackingFactor: number = 1.0;
  /** Oblique angle */
  oblique: number = 0.0;
  /** Paragraph properties */
  paragraph: ParagraphProperties = {
    indent: 0,
    left: 0,
    right: 0,
    align: MTextParagraphAlignment.DEFAULT,
    tab_stops: [],
  };

  /**
   * Get the ACI color value
   */
  get aci(): number {
    return this._aci;
  }

  /**
   * Set the ACI color value
   * @param value - ACI color value (0-256)
   * @throws Error if value is out of range
   */
  set aci(value: number) {
    if (value >= 0 && value <= 256) {
      this._aci = value;
      this.rgb = null;
    } else {
      throw new Error('ACI not in range [0, 256]');
    }
  }

  /**
   * Get whether text is underlined
   */
  get underline(): boolean {
    return Boolean(this._stroke & MTextStroke.UNDERLINE);
  }

  /**
   * Set whether text is underlined
   * @param value - Whether to underline
   */
  set underline(value: boolean) {
    this._setStrokeState(MTextStroke.UNDERLINE, value);
  }

  /**
   * Get whether text has strike-through
   */
  get strikeThrough(): boolean {
    return Boolean(this._stroke & MTextStroke.STRIKE_THROUGH);
  }

  /**
   * Set whether text has strike-through
   * @param value - Whether to strike through
   */
  set strikeThrough(value: boolean) {
    this._setStrokeState(MTextStroke.STRIKE_THROUGH, value);
  }

  /**
   * Get whether text has overline
   */
  get overline(): boolean {
    return Boolean(this._stroke & MTextStroke.OVERLINE);
  }

  /**
   * Set whether text has overline
   * @param value - Whether to overline
   */
  set overline(value: boolean) {
    this._setStrokeState(MTextStroke.OVERLINE, value);
  }

  /**
   * Check if any stroke formatting is active
   */
  get hasAnyStroke(): boolean {
    return Boolean(this._stroke);
  }

  /**
   * Set the state of a stroke type
   * @param stroke - The stroke type to set
   * @param state - Whether to enable or disable the stroke
   */
  private _setStrokeState(stroke: MTextStroke, state: boolean = true): void {
    if (state) {
      this._stroke |= stroke;
    } else {
      this._stroke &= ~stroke;
    }
  }

  /**
   * Create a copy of this context
   * @returns A new context with the same properties
   */
  copy(): MTextContext {
    const ctx = new MTextContext();
    ctx._stroke = this._stroke;
    ctx.continueStroke = this.continueStroke;
    ctx._aci = this._aci;
    ctx.rgb = this.rgb;
    ctx.align = this.align;
    ctx.fontFace = { ...this.fontFace };
    ctx.capHeight = this.capHeight;
    ctx.widthFactor = this.widthFactor;
    ctx.charTrackingFactor = this.charTrackingFactor;
    ctx.oblique = this.oblique;
    ctx.paragraph = { ...this.paragraph };
    return ctx;
  }
}

/**
 * Token class for MText parsing
 */
export class MTextToken {
  /**
   * Create a new MText token
   * @param type - The token type
   * @param ctx - The text context at this token
   * @param data - Optional token data
   */
  constructor(
    public type: TokenType,
    public ctx: MTextContext,
    public data: any = null
  ) {}
}
