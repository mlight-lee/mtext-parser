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
 * Represents a factor value that can be either absolute or relative.
 * Used for properties like height, width, and character tracking in MText formatting.
 */
export interface FactorValue {
  /** The numeric value of the factor */
  value: number;
  /** Whether the value is relative (true) or absolute (false) */
  isRelative: boolean;
}

/**
 * Format properties of MText word tokens.
 * This interface defines all the formatting properties that can be applied to MText content,
 * including text styling, colors, alignment, font properties, and paragraph formatting.
 */
export interface Properties {
  /** Whether text is underlined */
  underline?: boolean;
  /** Whether text has an overline */
  overline?: boolean;
  /** Whether text has strike-through */
  strikeThrough?: boolean;
  /** AutoCAD Color Index (ACI) color value (0-256), or null if not set */
  aci?: number | null;
  /** RGB color tuple [r, g, b], or null if not set */
  rgb?: RGB | null;
  /** Line alignment for the text */
  align?: MTextLineAlignment;
  /** Font face properties including family, style, and weight */
  fontFace?: FontFace;
  /** Capital letter height factor (can be relative or absolute) */
  capHeight?: FactorValue;
  /** Character width factor (can be relative or absolute) */
  widthFactor?: FactorValue;
  /** Character tracking factor for spacing between characters (can be relative or absolute) */
  charTrackingFactor?: FactorValue;
  /** Oblique angle in degrees for text slant */
  oblique?: number;
  /** Paragraph formatting properties (partial to allow selective updates) */
  paragraph?: Partial<ParagraphProperties>;
}

/**
 * Represents a change in MText properties, including the command, the changed properties, and the context depth.
 */
export interface ChangedProperties {
  /**
   * The property command that triggered the change (e.g., 'L', 'C', 'f').
   * The command will be undefined if it is to restore context.
   */
  command: string | undefined;
  /**
   * The set of properties that have changed as a result of the command.
   */
  changes: Properties;
  /**
   * The current context stack depth when the property change occurs.
   * - 0: The change is global (applies outside of any `{}` block).
   * - >0: The change is local (applies within one or more nested `{}` blocks).
   */
  depth: number; // 0 = global, >0 = local
}

/**
 * Type for token data based on token type
 */
export type TokenData = {
  [TokenType.NONE]: null;
  [TokenType.WORD]: string;
  [TokenType.STACK]: [string, string, string];
  [TokenType.SPACE]: null;
  [TokenType.NBSP]: null;
  [TokenType.TABULATOR]: null;
  [TokenType.NEW_PARAGRAPH]: null;
  [TokenType.NEW_COLUMN]: null;
  [TokenType.WRAP_AT_DIMLINE]: null;
  [TokenType.PROPERTIES_CHANGED]: ChangedProperties;
};

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
 * Font style type
 */
export type FontStyle = 'Regular' | 'Italic';

/**
 * Font face properties
 */
export interface FontFace {
  /** Font family name */
  family: string;
  /** Font style (e.g., 'Regular', 'Italic') */
  style: FontStyle;
  /** Font weight (e.g., 400 for normal, 700 for bold) */
  weight: number;
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
  tabs: (number | string)[];
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
 * Extracts all unique font names used in an MText string.
 * This function searches for font commands in the format \f{fontname}| or \f{fontname}; and returns a set of unique font names.
 * Font names are converted to lowercase to ensure case-insensitive uniqueness.
 *
 * @param mtext - The MText string to analyze for font names
 * @param removeExtension - Whether to remove font file extensions (e.g., .ttf, .shx) from font names. Defaults to false.
 * @returns A Set containing all unique font names found in the MText string, converted to lowercase
 * @example
 * ```ts
 * const mtext = "\\fArial.ttf|Hello\\fTimes New Roman.otf|World";
 * const fonts = getFonts(mtext, true);
 * // Returns: Set(2) { "arial", "times new roman" }
 * ```
 */
export function getFonts(mtext: string, removeExtension: boolean = false) {
  const fonts: Set<string> = new Set();
  const regex = /\\[fF](.*?)[;|]/g;

  [...mtext.matchAll(regex)].forEach(match => {
    let fontName = match[1].toLowerCase();
    if (removeExtension) {
      fontName = fontName.replace(/\.(ttf|otf|woff|shx)$/, '');
    }
    fonts.add(fontName);
  });

  return fonts;
}

/**
 * ContextStack manages a stack of MTextContext objects for character-level formatting.
 *
 * - Character-level formatting (underline, color, font, etc.) is scoped to `{}` blocks and managed by the stack.
 * - Paragraph-level formatting (\p) is not scoped, but when a block ends, any paragraph property changes are merged into the parent context.
 * - On pop, paragraph properties from the popped context are always merged into the new top context.
 */
class ContextStack {
  private stack: MTextContext[] = [];

  /**
   * Creates a new ContextStack with an initial context.
   * @param initial The initial MTextContext to use as the base of the stack.
   */
  constructor(initial: MTextContext) {
    this.stack.push(initial);
  }

  /**
   * Pushes a copy of the given context onto the stack.
   * @param ctx The MTextContext to push (copied).
   */
  push(ctx: MTextContext) {
    this.stack.push(ctx);
  }

  /**
   * Pops the top context from the stack and merges its paragraph properties into the new top context.
   * If only one context remains, nothing is popped.
   * @returns The popped MTextContext, or undefined if the stack has only one context.
   */
  pop(): MTextContext | undefined {
    if (this.stack.length <= 1) return undefined;
    const popped = this.stack.pop()!;
    // Merge paragraph properties into the new top context
    const top = this.stack[this.stack.length - 1];
    if (JSON.stringify(top.paragraph) !== JSON.stringify(popped.paragraph)) {
      top.paragraph = { ...popped.paragraph };
    }
    return popped;
  }

  /**
   * Returns the current (top) context on the stack.
   */
  get current(): MTextContext {
    return this.stack[this.stack.length - 1];
  }

  /**
   * Returns the current stack depth (number of nested blocks), not counting the root context.
   */
  get depth(): number {
    return this.stack.length - 1;
  }

  /**
   * Returns the root (bottom) context, which represents the global formatting state.
   * Used for paragraph property application.
   */
  get root(): MTextContext {
    return this.stack[0];
  }

  /**
   * Replaces the current (top) context with the given context.
   * @param ctx The new context to set as the current context.
   */
  setCurrent(ctx: MTextContext) {
    this.stack[this.stack.length - 1] = ctx;
  }
}

/**
 * Configuration options for the MText parser.
 * These options control how the parser behaves during tokenization and property handling.
 */
export interface MTextParserOptions {
  /**
   * Whether to yield PROPERTIES_CHANGED tokens when formatting properties change.
   * When true, the parser will emit tokens whenever properties like color, font, or alignment change.
   * When false, property changes are applied silently to the context without generating tokens.
   * @default false
   */
  yieldPropertyCommands?: boolean;
  /**
   * Whether to reset paragraph parameters when encountering a new paragraph token.
   * When true, paragraph properties (indent, margins, alignment, tab stops) are reset to defaults
   * at the start of each new paragraph.
   * @default false
   */
  resetParagraphParameters?: boolean;
}

/**
 * Main parser class for MText content
 */
export class MTextParser {
  private scanner: TextScanner;
  private ctxStack: ContextStack;
  private continueStroke: boolean = false;
  private yieldPropertyCommands: boolean;
  private resetParagraphParameters: boolean;
  private inStackContext: boolean = false;

  /**
   * Creates a new MTextParser instance
   * @param content - The MText content to parse
   * @param ctx - Optional initial MText context
   * @param options - Parser options
   */
  constructor(content: string, ctx?: MTextContext, options: MTextParserOptions = {}) {
    this.scanner = new TextScanner(content);
    const initialCtx = ctx ?? new MTextContext();
    this.ctxStack = new ContextStack(initialCtx);
    this.yieldPropertyCommands = options.yieldPropertyCommands ?? false;
    this.resetParagraphParameters = options.resetParagraphParameters ?? false;
  }

  /**
   * Decode multi-byte character from hex code
   * @param hex - Hex code string (e.g. "C4E3")
   * @returns Decoded character or empty square if invalid
   */
  private decodeMultiByteChar(hex: string): string {
    try {
      const bytes = new Uint8Array([
        parseInt(hex.substr(0, 2), 16),
        parseInt(hex.substr(2, 2), 16),
      ]);

      // Try GBK first
      const gbkDecoder = new TextDecoder('gbk');
      const gbkResult = gbkDecoder.decode(bytes);
      if (gbkResult !== '▯') {
        return gbkResult;
      }

      // Try BIG5 if GBK fails
      const big5Decoder = new TextDecoder('big5');
      const big5Result = big5Decoder.decode(bytes);
      if (big5Result !== '▯') {
        return big5Result;
      }

      return '▯';
    } catch {
      return '▯';
    }
  }

  /**
   * Push current context onto the stack
   */
  private pushCtx(): void {
    this.ctxStack.push(this.ctxStack.current);
  }

  /**
   * Pop context from the stack
   */
  private popCtx(): void {
    this.ctxStack.pop();
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
        // Check for stacking operators first
        if (!escape && (c === '/' || c === '#' || c === '^')) {
          return [word, c];
        }
        word += c;
      }
      return [word, ''];
    };

    const parseDenominator = (skipLeadingSpace: boolean): string => {
      let word = '';
      let skipping = skipLeadingSpace;
      while (scanner.hasData) {
        const [c, escape] = getNextChar();
        if (skipping && c === ' ') {
          continue;
        }
        skipping = false;
        // Stop at terminator unless escaped
        if (!escape && c === ';') {
          break;
        }
        word += c;
      }
      return word;
    };

    [numerator, stackingType] = parseNumerator();
    if (stackingType) {
      // Only skip leading space for caret divider
      denominator = parseDenominator(stackingType === '^');
    }

    // Special case for \S^!/^?;
    if (numerator === '' && denominator.includes('I/')) {
      return [TokenType.STACK, [' ', ' ', '/']];
    }

    // Handle caret as a stacking operator
    if (stackingType === '^') {
      return [TokenType.STACK, [numerator, denominator, '^']];
    }

    return [TokenType.STACK, [numerator, denominator, stackingType]];
  }

  /**
   * Parse MText properties
   * @param cmd - The property command to parse
   * @returns Property changes if yieldPropertyCommands is true and changes occurred
   */
  private parseProperties(cmd: string): TokenData[TokenType.PROPERTIES_CHANGED] | void {
    const prevCtx = this.ctxStack.current.copy();
    const newCtx = this.ctxStack.current.copy();
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

    // Update continueStroke based on current stroke state
    this.continueStroke = newCtx.hasAnyStroke;
    newCtx.continueStroke = this.continueStroke;
    // Use setCurrent to replace the current context
    this.ctxStack.setCurrent(newCtx);

    if (this.yieldPropertyCommands) {
      const changes = this.getPropertyChanges(prevCtx, newCtx);
      if (Object.keys(changes).length > 0) {
        return {
          command: cmd,
          changes,
          depth: this.ctxStack.depth,
        };
      }
    }
  }

  /**
   * Get property changes between two contexts
   * @param oldCtx - The old context
   * @param newCtx - The new context
   * @returns Object containing changed properties
   */
  private getPropertyChanges(
    oldCtx: MTextContext,
    newCtx: MTextContext
  ): TokenData[TokenType.PROPERTIES_CHANGED]['changes'] {
    const changes: TokenData[TokenType.PROPERTIES_CHANGED]['changes'] = {};

    if (oldCtx.underline !== newCtx.underline) {
      changes.underline = newCtx.underline;
    }
    if (oldCtx.overline !== newCtx.overline) {
      changes.overline = newCtx.overline;
    }
    if (oldCtx.strikeThrough !== newCtx.strikeThrough) {
      changes.strikeThrough = newCtx.strikeThrough;
    }
    if (oldCtx.color.aci !== newCtx.color.aci) {
      changes.aci = newCtx.color.aci;
    }
    if (oldCtx.color.rgbValue !== newCtx.color.rgbValue) {
      changes.rgb = newCtx.color.rgb;
    }
    if (oldCtx.align !== newCtx.align) {
      changes.align = newCtx.align;
    }
    if (JSON.stringify(oldCtx.fontFace) !== JSON.stringify(newCtx.fontFace)) {
      changes.fontFace = newCtx.fontFace;
    }
    if (
      oldCtx.capHeight.value !== newCtx.capHeight.value ||
      oldCtx.capHeight.isRelative !== newCtx.capHeight.isRelative
    ) {
      changes.capHeight = newCtx.capHeight;
    }
    if (
      oldCtx.widthFactor.value !== newCtx.widthFactor.value ||
      oldCtx.widthFactor.isRelative !== newCtx.widthFactor.isRelative
    ) {
      changes.widthFactor = newCtx.widthFactor;
    }
    if (
      oldCtx.charTrackingFactor.value !== newCtx.charTrackingFactor.value ||
      oldCtx.charTrackingFactor.isRelative !== newCtx.charTrackingFactor.isRelative
    ) {
      changes.charTrackingFactor = newCtx.charTrackingFactor;
    }
    if (oldCtx.oblique !== newCtx.oblique) {
      changes.oblique = newCtx.oblique;
    }
    if (JSON.stringify(oldCtx.paragraph) !== JSON.stringify(newCtx.paragraph)) {
      // Only include changed paragraph properties
      const changedProps: Partial<ParagraphProperties> = {};
      if (oldCtx.paragraph.indent !== newCtx.paragraph.indent) {
        changedProps.indent = newCtx.paragraph.indent;
      }
      if (oldCtx.paragraph.align !== newCtx.paragraph.align) {
        changedProps.align = newCtx.paragraph.align;
      }
      if (oldCtx.paragraph.left !== newCtx.paragraph.left) {
        changedProps.left = newCtx.paragraph.left;
      }
      if (oldCtx.paragraph.right !== newCtx.paragraph.right) {
        changedProps.right = newCtx.paragraph.right;
      }
      if (JSON.stringify(oldCtx.paragraph.tabs) !== JSON.stringify(newCtx.paragraph.tabs)) {
        changedProps.tabs = newCtx.paragraph.tabs;
      }
      if (Object.keys(changedProps).length > 0) {
        changes.paragraph = changedProps;
      }
    }

    return changes;
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
          // For height command, treat x suffix as relative value
          ctx.capHeight = {
            value: parseFloat(expr.slice(0, -1)),
            isRelative: true,
          };
        } else {
          ctx.capHeight = {
            value: parseFloat(expr),
            isRelative: false,
          };
        }
      } catch {
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
          // For width command, treat x suffix as relative value
          ctx.widthFactor = {
            value: parseFloat(expr.slice(0, -1)),
            isRelative: true,
          };
        } else {
          ctx.widthFactor = {
            value: parseFloat(expr),
            isRelative: false,
          };
        }
      } catch {
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
          // For tracking command, treat x suffix as relative value
          ctx.charTrackingFactor = {
            value: Math.abs(parseFloat(expr.slice(0, -1))),
            isRelative: true,
          };
        } else {
          ctx.charTrackingFactor = {
            value: Math.abs(parseFloat(expr)),
            isRelative: false,
          };
        }
      } catch {
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
        value *= factor; // Allow negative factors
      } else {
        value = parseFloat(expr); // Allow negative values
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
        ctx.color.aci = aci;
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
      ctx.color.rgbValue = value;
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
      let style: FontStyle = 'Regular';
      let weight = 400;

      for (const part of parts.slice(1)) {
        if (part.startsWith('b1')) {
          weight = 700;
        } else if (part === 'i' || part.startsWith('i1')) {
          style = 'Italic';
        } else if (part === 'i0' || part.startsWith('i0')) {
          style = 'Regular';
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
        case 'q': {
          // Alignment
          const adjustment = scanner.get();
          align = CHAR_TO_ALIGN[adjustment] || MTextParagraphAlignment.DEFAULT;
          while (scanner.peek() === ',') {
            scanner.consume(1);
          }
          break;
        }
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
      tabs: tabStops,
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
    const wordToken = TokenType.WORD;
    const spaceToken = TokenType.SPACE;
    let followupToken: TokenType | null = null;

    function resetParagraph(ctx: MTextContext): Partial<ParagraphProperties> {
      const prev = { ...ctx.paragraph };
      ctx.paragraph = {
        indent: 0,
        left: 0,
        right: 0,
        align: MTextParagraphAlignment.DEFAULT,
        tabs: [],
      };
      const changed: Partial<ParagraphProperties> = {};
      if (prev.indent !== 0) changed.indent = 0;
      if (prev.left !== 0) changed.left = 0;
      if (prev.right !== 0) changed.right = 0;
      if (prev.align !== MTextParagraphAlignment.DEFAULT)
        changed.align = MTextParagraphAlignment.DEFAULT;
      if (JSON.stringify(prev.tabs) !== JSON.stringify([])) changed.tabs = [];
      return changed;
    }

    const nextToken = (): [TokenType, TokenData[TokenType]] => {
      let word = '';
      while (this.scanner.hasData) {
        let escape = false;
        let letter = this.scanner.peek();
        const cmdStartIndex = this.scanner.currentIndex;

        // Handle control characters first
        if (letter.charCodeAt(0) < 32) {
          this.scanner.consume(1); // Always consume the control character
          if (letter === '\t') {
            return [TokenType.TABULATOR, null];
          }
          if (letter === '\n') {
            return [TokenType.NEW_PARAGRAPH, null];
          }
          letter = ' ';
        }

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
              case 'S': {
                this.inStackContext = true;
                const result = this.parseStacking();
                this.inStackContext = false;
                return result;
              }
              case 'm':
              case 'M':
                // Handle multi-byte character encoding
                if (this.scanner.peek() === '+') {
                  this.scanner.consume(1); // Consume the '+'
                  const hexCode = this.scanner.tail.match(/^[0-9A-Fa-f]{4}/)?.[0];
                  if (hexCode) {
                    this.scanner.consume(4);
                    const decodedChar = this.decodeMultiByteChar(hexCode);
                    if (word) {
                      return [wordToken, word];
                    }
                    return [wordToken, decodedChar];
                  }
                  // If no valid hex code found, rewind the '+' character
                  this.scanner.consume(-1);
                }
                // If not a valid multi-byte code, treat as literal text
                word += '\\M';
                continue;
              default:
                if (cmd) {
                  try {
                    const propertyChanges = this.parseProperties(cmd);
                    if (this.yieldPropertyCommands && propertyChanges) {
                      return [TokenType.PROPERTIES_CHANGED, propertyChanges];
                    }
                    // After processing a property command, continue with normal parsing
                    continue;
                  } catch {
                    const commandText = this.scanner.tail.slice(
                      cmdStartIndex,
                      this.scanner.currentIndex
                    );
                    word += commandText;
                  }
                }
            }
            continue;
          }
        }

        if (letter === '%' && this.scanner.peek(1) === '%') {
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
            // Context restoration with yieldPropertyCommands
            if (this.yieldPropertyCommands) {
              const prevCtx = this.ctxStack.current;
              this.popCtx();
              const changes = this.getPropertyChanges(prevCtx, this.ctxStack.current);
              if (Object.keys(changes).length > 0) {
                return [
                  TokenType.PROPERTIES_CHANGED,
                  { command: undefined, changes, depth: this.ctxStack.depth },
                ];
              }
            } else {
              this.popCtx();
            }
            continue;
          }
        }

        // Handle caret-encoded characters only when not in stack context
        if (!this.inStackContext && letter === '^') {
          const nextChar = this.scanner.peek(1);
          if (nextChar) {
            const code = nextChar.charCodeAt(0);
            this.scanner.consume(2); // Consume both ^ and the next character
            if (code === 32) {
              // Space
              word += '^';
            } else if (code === 73) {
              // Tab
              if (word) {
                return [wordToken, word];
              }
              return [TokenType.TABULATOR, null];
            } else if (code === 74) {
              // Line feed
              if (word) {
                return [wordToken, word];
              }
              return [TokenType.NEW_PARAGRAPH, null];
            } else if (code === 77) {
              // Carriage return
              // Ignore carriage return
              continue;
            } else {
              word += '▯';
            }
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
      const [type, data] = nextToken.call(this);
      if (type) {
        yield new MTextToken(type, this.ctxStack.current.copy(), data);
        if (type === TokenType.NEW_PARAGRAPH && this.resetParagraphParameters) {
          // Reset paragraph properties and emit PROPERTIES_CHANGED if needed
          const ctx = this.ctxStack.current;
          const changed = resetParagraph(ctx);
          if (this.yieldPropertyCommands && Object.keys(changed).length > 0) {
            yield new MTextToken(TokenType.PROPERTIES_CHANGED, ctx.copy(), {
              command: undefined,
              changes: { paragraph: changed },
              depth: this.ctxStack.depth,
            });
          }
        }
        if (followupToken) {
          yield new MTextToken(followupToken, this.ctxStack.current.copy(), null);
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
    this._index = Math.max(0, Math.min(this._index + count, this.textLen));
  }

  /**
   * Look at a character without advancing the index
   * @param offset - Offset from current position
   * @returns The character at the offset position, or empty string if out of bounds
   */
  peek(offset: number = 0): string {
    const index = this._index + offset;
    if (index >= this.textLen || index < 0) {
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
 * Class to handle ACI and RGB color logic for MText.
 *
 * This class encapsulates color state for MText, supporting both AutoCAD Color Index (ACI) and RGB color.
 * Only one color mode is active at a time: setting an RGB color disables ACI, and vice versa.
 * RGB is stored as a single 24-bit integer (0xRRGGBB) for efficient comparison and serialization.
 *
 * Example usage:
 * ```ts
 * const color1 = new MTextColor(1); // ACI color
 * const color2 = new MTextColor([255, 0, 0]); // RGB color
 * const color3 = new MTextColor(); // Default (ACI=256, "by layer")
 * ```
 */
export class MTextColor {
  /**
   * The AutoCAD Color Index (ACI) value. Only used if no RGB color is set.
   * @default 256 ("by layer")
   */
  private _aci: number | null = 256;
  /**
   * The RGB color value as a single 24-bit integer (0xRRGGBB), or null if not set.
   * @default null
   */
  private _rgbValue: number | null = null; // Store as 0xRRGGBB or null

  /**
   * Create a new MTextColor instance.
   * @param color The initial color: number for ACI, [r,g,b] for RGB, or null/undefined for default (ACI=256).
   */
  constructor(color?: number | RGB | null) {
    if (Array.isArray(color)) {
      this.rgb = color;
    } else if (typeof color === 'number') {
      this.aci = color;
    } else {
      this.aci = 256;
    }
  }

  /**
   * Get the current ACI color value.
   * @returns The ACI color (0-256), or null if using RGB.
   */
  get aci(): number | null {
    return this._aci;
  }

  /**
   * Set the ACI color value. Setting this disables any RGB color.
   * @param value The ACI color (0-256), or null to unset.
   * @throws Error if value is out of range.
   */
  set aci(value: number | null) {
    if (value === null) {
      this._aci = null;
    } else if (value >= 0 && value <= 256) {
      this._aci = value;
      this._rgbValue = null;
    } else {
      throw new Error('ACI not in range [0, 256]');
    }
  }

  /**
   * Get the current RGB color as a tuple [r, g, b], or null if not set.
   * @returns The RGB color tuple, or null if using ACI.
   */
  get rgb(): RGB | null {
    if (this._rgbValue === null) return null;
    // Extract R, G, B from 0xRRGGBB
    const r = (this._rgbValue >> 16) & 0xff;
    const g = (this._rgbValue >> 8) & 0xff;
    const b = this._rgbValue & 0xff;
    return [r, g, b];
  }

  /**
   * Set the RGB color. Setting this disables ACI color.
   * @param value The RGB color tuple [r, g, b], or null to use ACI.
   */
  set rgb(value: RGB | null) {
    if (value) {
      const [r, g, b] = value;
      this._rgbValue = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
      this._aci = null;
    } else {
      this._rgbValue = null;
    }
  }

  /**
   * Returns true if the color is set by RGB, false if by ACI.
   */
  get isRgb(): boolean {
    return this._rgbValue !== null;
  }

  /**
   * Returns true if the color is set by ACI, false if by RGB.
   */
  get isAci(): boolean {
    return this._rgbValue === null && this._aci !== null;
  }

  /**
   * Get or set the internal RGB value as a number (0xRRGGBB), or null if not set.
   * Setting this will switch to RGB mode and set ACI to null.
   */
  get rgbValue(): number | null {
    return this._rgbValue;
  }

  set rgbValue(val: number | null) {
    if (val === null) {
      this._rgbValue = null;
    } else {
      this._rgbValue = val & 0xffffff;
      this._aci = null;
    }
  }

  /**
   * Returns a deep copy of this color.
   * @returns A new MTextColor instance with the same color state.
   */
  copy(): MTextColor {
    const c = new MTextColor();
    c._aci = this._aci;
    c._rgbValue = this._rgbValue;
    return c;
  }

  /**
   * Returns a plain object for serialization.
   * @returns An object with aci, rgb (tuple), and rgbValue (number or null).
   */
  toObject(): { aci: number | null; rgb: RGB | null; rgbValue: number | null } {
    return { aci: this._aci, rgb: this.rgb, rgbValue: this._rgbValue };
  }

  /**
   * Equality check for color.
   * @param other The other MTextColor to compare.
   * @returns True if both ACI and RGB values are equal.
   */
  equals(other: MTextColor): boolean {
    return this._aci === other._aci && this._rgbValue === other._rgbValue;
  }
}

/**
 * MText context class for managing text formatting state
 */
export class MTextContext {
  private _stroke: number = 0;
  /** Whether to continue stroke formatting */
  continueStroke: boolean = false;
  /** Color (ACI or RGB) */
  color: MTextColor = new MTextColor();
  /** Line alignment */
  align: MTextLineAlignment = MTextLineAlignment.BOTTOM;
  /** Font face properties */
  fontFace: FontFace = { family: '', style: 'Regular', weight: 400 };
  /** Capital letter height */
  private _capHeight: FactorValue = { value: 1.0, isRelative: false };
  /** Character width factor */
  private _widthFactor: FactorValue = { value: 1.0, isRelative: false };
  /**
   * Character tracking factor a multiplier applied to the default spacing between characters in the MText object.
   * - Value = 1.0 → Normal spacing.
   * - Value < 1.0 → Characters are closer together.
   * - Value > 1.0 → Characters are spaced farther apart.
   */
  private _charTrackingFactor: FactorValue = { value: 1.0, isRelative: false };
  /** Oblique angle */
  oblique: number = 0.0;
  /** Paragraph properties */
  paragraph: ParagraphProperties = {
    indent: 0,
    left: 0,
    right: 0,
    align: MTextParagraphAlignment.DEFAULT,
    tabs: [],
  };

  /**
   * Get the capital letter height
   */
  get capHeight(): FactorValue {
    return this._capHeight;
  }

  /**
   * Set the capital letter height
   * @param value - Height value
   */
  set capHeight(value: FactorValue) {
    this._capHeight = {
      value: Math.abs(value.value),
      isRelative: value.isRelative,
    };
  }

  /**
   * Get the character width factor
   */
  get widthFactor(): FactorValue {
    return this._widthFactor;
  }

  /**
   * Set the character width factor
   * @param value - Width factor value
   */
  set widthFactor(value: FactorValue) {
    this._widthFactor = {
      value: Math.abs(value.value),
      isRelative: value.isRelative,
    };
  }

  /**
   * Get the character tracking factor
   */
  get charTrackingFactor(): FactorValue {
    return this._charTrackingFactor;
  }

  /**
   * Set the character tracking factor
   * @param value - Tracking factor value
   */
  set charTrackingFactor(value: FactorValue) {
    this._charTrackingFactor = {
      value: Math.abs(value.value),
      isRelative: value.isRelative,
    };
  }

  /**
   * Get the ACI color value
   */
  get aci(): number | null {
    return this.color.aci;
  }

  /**
   * Set the ACI color value
   * @param value - ACI color value (0-256)
   * @throws Error if value is out of range
   */
  set aci(value: number) {
    this.color.aci = value;
  }

  /**
   * Get the RGB color value
   */
  get rgb(): RGB | null {
    return this.color.rgb;
  }

  /**
   * Set the RGB color value
   */
  set rgb(value: RGB | null) {
    this.color.rgb = value;
  }

  /**
   * Gets whether the current text should be rendered in italic style.
   * @returns {boolean} True if the font style is 'Italic', otherwise false.
   */
  get italic(): boolean {
    return this.fontFace.style === 'Italic';
  }
  /**
   * Sets whether the current text should be rendered in italic style.
   * @param value - If true, sets the font style to 'Italic'; if false, sets it to 'Regular'.
   */
  set italic(value: boolean) {
    this.fontFace.style = value ? 'Italic' : 'Regular';
  }

  /**
   * Gets whether the current text should be rendered in bold style.
   * This is primarily used for mesh fonts and affects font selection.
   * @returns {boolean} True if the font weight is 700 or higher, otherwise false.
   */
  get bold(): boolean {
    return (this.fontFace.weight || 400) >= 700;
  }
  /**
   * Sets whether the current text should be rendered in bold style.
   * This is primarily used for mesh fonts and affects font selection.
   * @param value - If true, sets the font weight to 700; if false, sets it to 400.
   */
  set bold(value: boolean) {
    this.fontFace.weight = value ? 700 : 400;
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
    ctx.color = this.color.copy();
    ctx.align = this.align;
    ctx.fontFace = { ...this.fontFace };
    ctx._capHeight = { ...this._capHeight };
    ctx._widthFactor = { ...this._widthFactor };
    ctx._charTrackingFactor = { ...this._charTrackingFactor };
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
    public data: TokenData[TokenType]
  ) {}
}
