import {
  MTextParser,
  MTextContext,
  TokenType,
  MTextLineAlignment,
  MTextParagraphAlignment,
  rgb2int,
  int2rgb,
  caretDecode,
  escapeDxfLineEndings,
  hasInlineFormattingCodes,
  TextScanner,
} from './parser';

describe('Utility Functions', () => {
  describe('rgb2int', () => {
    it('converts RGB tuple to integer', () => {
      expect(rgb2int([255, 0, 0])).toBe(0x0000ff);
      expect(rgb2int([0, 255, 0])).toBe(0x00ff00);
      expect(rgb2int([0, 0, 255])).toBe(0xff0000);
    });
  });

  describe('int2rgb', () => {
    it('converts integer to RGB tuple', () => {
      expect(int2rgb(0x0000ff)).toEqual([255, 0, 0]);
      expect(int2rgb(0x00ff00)).toEqual([0, 255, 0]);
      expect(int2rgb(0xff0000)).toEqual([0, 0, 255]);
    });
  });

  describe('caretDecode', () => {
    it('handles control characters', () => {
      expect(caretDecode('^I')).toBe('\t'); // Tabulator
      expect(caretDecode('^J')).toBe('\n'); // Line feed
      expect(caretDecode('^M')).toBe(''); // Carriage return is ignored
    });

    it('handles space after caret', () => {
      expect(caretDecode('1^ 2')).toBe('1^2');
      expect(caretDecode('^ ')).toBe('^');
    });

    it('renders empty square for unknown characters', () => {
      expect(caretDecode('^!')).toBe('▯');
      expect(caretDecode('^?')).toBe('▯');
      expect(caretDecode('^#')).toBe('▯');
      expect(caretDecode('^a')).toBe('▯');
      expect(caretDecode('^z')).toBe('▯');
      expect(caretDecode('^@')).toBe('▯');
      expect(caretDecode('^A')).toBe('▯');
      expect(caretDecode('^Z')).toBe('▯');
      expect(caretDecode('^[')).toBe('▯');
      expect(caretDecode('^\\')).toBe('▯');
      expect(caretDecode('^]')).toBe('▯');
      expect(caretDecode('^^')).toBe('▯');
      expect(caretDecode('^_')).toBe('▯');
    });

    it('handles mixed cases', () => {
      expect(caretDecode('Hello^JWorld')).toBe('Hello\nWorld');
      expect(caretDecode('Tab^ISpace^ ')).toBe('Tab\tSpace^');
      expect(caretDecode('^M^J^I')).toBe('\n\t');
      expect(caretDecode('Text^!More')).toBe('Text▯More');
    });
  });

  describe('escapeDxfLineEndings', () => {
    it('escapes line endings', () => {
      expect(escapeDxfLineEndings('line1\r\nline2')).toBe('line1\\Pline2');
      expect(escapeDxfLineEndings('line1\nline2')).toBe('line1\\Pline2');
      expect(escapeDxfLineEndings('line1\rline2')).toBe('line1\\Pline2');
    });
  });

  describe('hasInlineFormattingCodes', () => {
    it('detects inline formatting codes', () => {
      expect(hasInlineFormattingCodes('\\L')).toBe(true);
      expect(hasInlineFormattingCodes('\\P')).toBe(false);
      expect(hasInlineFormattingCodes('\\~')).toBe(false);
      expect(hasInlineFormattingCodes('normal text')).toBe(false);
    });
  });
});

describe('MTextContext', () => {
  let ctx: MTextContext;

  beforeEach(() => {
    ctx = new MTextContext();
  });

  it('initializes with default values', () => {
    expect(ctx.aci).toBe(7);
    expect(ctx.rgb).toBeNull();
    expect(ctx.align).toBe(MTextLineAlignment.BOTTOM);
    expect(ctx.fontFace).toEqual({ family: '', style: 'Regular', weight: 400 });
    expect(ctx.capHeight).toBe(1.0);
    expect(ctx.widthFactor).toBe(1.0);
    expect(ctx.charTrackingFactor).toBe(1.0);
    expect(ctx.oblique).toBe(0.0);
    expect(ctx.paragraph).toEqual({
      indent: 0,
      left: 0,
      right: 0,
      align: MTextParagraphAlignment.DEFAULT,
      tab_stops: [],
    });
  });

  describe('stroke properties', () => {
    it('handles underline', () => {
      ctx.underline = true;
      expect(ctx.underline).toBe(true);
      expect(ctx.hasAnyStroke).toBe(true);
      ctx.underline = false;
      expect(ctx.underline).toBe(false);
      expect(ctx.hasAnyStroke).toBe(false);
    });

    it('handles overline', () => {
      ctx.overline = true;
      expect(ctx.overline).toBe(true);
      expect(ctx.hasAnyStroke).toBe(true);
      ctx.overline = false;
      expect(ctx.overline).toBe(false);
      expect(ctx.hasAnyStroke).toBe(false);
    });

    it('handles strike-through', () => {
      ctx.strikeThrough = true;
      expect(ctx.strikeThrough).toBe(true);
      expect(ctx.hasAnyStroke).toBe(true);
      ctx.strikeThrough = false;
      expect(ctx.strikeThrough).toBe(false);
      expect(ctx.hasAnyStroke).toBe(false);
    });

    it('handles multiple strokes', () => {
      ctx.underline = true;
      ctx.overline = true;
      expect(ctx.hasAnyStroke).toBe(true);
      ctx.underline = false;
      expect(ctx.hasAnyStroke).toBe(true);
      ctx.overline = false;
      expect(ctx.hasAnyStroke).toBe(false);
    });
  });

  describe('color properties', () => {
    it('handles ACI color', () => {
      ctx.aci = 1;
      expect(ctx.aci).toBe(1);
      expect(ctx.rgb).toBeNull();
      expect(() => (ctx.aci = 257)).toThrow('ACI not in range [0, 256]');
    });

    it('handles RGB color', () => {
      ctx.rgb = [255, 0, 0];
      expect(ctx.rgb).toEqual([255, 0, 0]);
    });
  });

  describe('copy', () => {
    it('creates a deep copy', () => {
      ctx.underline = true;
      ctx.rgb = [255, 0, 0];
      const copy = ctx.copy();
      expect(copy).not.toBe(ctx);
      expect(copy.underline).toBe(ctx.underline);
      expect(copy.rgb).toEqual(ctx.rgb);
      expect(copy.fontFace).toEqual(ctx.fontFace);
      expect(copy.paragraph).toEqual(ctx.paragraph);
    });
  });
});

describe('MTextParser', () => {
  describe('basic parsing', () => {
    it('parses plain text', () => {
      const parser = new MTextParser('Hello World');
      const tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(3);
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('Hello');
      expect(tokens[1].type).toBe(TokenType.SPACE);
      expect(tokens[2].type).toBe(TokenType.WORD);
      expect(tokens[2].data).toBe('World');
    });

    it('parses spaces', () => {
      const parser = new MTextParser('Hello World');
      const tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(3);
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('Hello');
      expect(tokens[1].type).toBe(TokenType.SPACE);
      expect(tokens[2].type).toBe(TokenType.WORD);
      expect(tokens[2].data).toBe('World');
    });

    it('parses text starting with control characters', () => {
      // Test with newline
      let parser = new MTextParser('\nHello World');
      let tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(4);
      expect(tokens[0].type).toBe(TokenType.NEW_PARAGRAPH);
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[1].data).toBe('Hello');
      expect(tokens[2].type).toBe(TokenType.SPACE);
      expect(tokens[3].type).toBe(TokenType.WORD);
      expect(tokens[3].data).toBe('World');

      // Test with tab
      parser = new MTextParser('\tHello World');
      tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(4);
      expect(tokens[0].type).toBe(TokenType.TABULATOR);
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[1].data).toBe('Hello');
      expect(tokens[2].type).toBe(TokenType.SPACE);
      expect(tokens[3].type).toBe(TokenType.WORD);
      expect(tokens[3].data).toBe('World');

      // Test with multiple control characters
      parser = new MTextParser('\n\tHello World');
      tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(5);
      expect(tokens[0].type).toBe(TokenType.NEW_PARAGRAPH);
      expect(tokens[1].type).toBe(TokenType.TABULATOR);
      expect(tokens[2].type).toBe(TokenType.WORD);
      expect(tokens[2].data).toBe('Hello');
      expect(tokens[3].type).toBe(TokenType.SPACE);
      expect(tokens[4].type).toBe(TokenType.WORD);
      expect(tokens[4].data).toBe('World');
    });

    it('parses new paragraphs', () => {
      const parser = new MTextParser('Line 1\\PLine 2');
      const tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(7);
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('Line');
      expect(tokens[1].type).toBe(TokenType.SPACE);
      expect(tokens[2].type).toBe(TokenType.WORD);
      expect(tokens[2].data).toBe('1');
      expect(tokens[3].type).toBe(TokenType.NEW_PARAGRAPH);
      expect(tokens[4].type).toBe(TokenType.WORD);
      expect(tokens[4].data).toBe('Line');
      expect(tokens[5].type).toBe(TokenType.SPACE);
      expect(tokens[6].type).toBe(TokenType.WORD);
      expect(tokens[6].data).toBe('2');
    });
  });

  describe('formatting', () => {
    it('parses underline', () => {
      const parser = new MTextParser('\\LUnderlined\\l');
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('Underlined');
      expect(tokens[0].ctx.underline).toBe(true);
    });

    it('parses color', () => {
      const parser = new MTextParser('\\C1Red Text');
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('Red');
      expect(tokens[0].ctx.aci).toBe(1);
    });

    it('parses font properties', () => {
      const parser = new MTextParser('\\FArial|b1|i1;Bold Italic');
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('Bold');
      expect(tokens[0].ctx.fontFace).toEqual({
        family: 'Arial',
        style: 'Italic',
        weight: 700,
      });
    });

    describe('height command', () => {
      it('parses absolute height values', () => {
        const parser = new MTextParser('\\H2.5;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(2.5);
      });

      it('parses relative height values with x suffix', () => {
        const parser = new MTextParser('\\H2.5x;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(2.5);
      });

      it('handles optional terminator', () => {
        const parser = new MTextParser('\\H2.5Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(2.5);
      });

      it('handles leading signs', () => {
        let parser = new MTextParser('\\H-2.5;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(2.5); // Negative values are ignored

        parser = new MTextParser('\\H+2.5;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(2.5);
      });

      it('handles decimal values without leading zero', () => {
        let parser = new MTextParser('\\H.5x;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(0.5);

        parser = new MTextParser('\\H-.5x;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(0.5); // Negative values are ignored

        parser = new MTextParser('\\H+.5x;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(0.5);
      });

      it('handles exponential notation', () => {
        let parser = new MTextParser('\\H1e2;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(100);

        parser = new MTextParser('\\H1e-2;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(0.01);

        parser = new MTextParser('\\H.5e2;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(50);

        parser = new MTextParser('\\H.5e-2;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(0.005);
      });

      it('handles invalid floating point values', () => {
        let parser = new MTextParser('\\H1..5;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('.5;Text');
        expect(tokens[0].ctx.capHeight).toBe(1.0); // Default value

        parser = new MTextParser('\\H1e;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('e;Text');
        expect(tokens[0].ctx.capHeight).toBe(1.0); // Default value

        parser = new MTextParser('\\H1e+;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('e+;Text');
        expect(tokens[0].ctx.capHeight).toBe(1.0); // Default value
      });

      it('handles complex height expressions', () => {
        let parser = new MTextParser('\\H+1.5e-1x;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(0.15);

        parser = new MTextParser('\\H-.5e+2x;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(50); // Negative values are ignored
      });

      it('handles multiple height commands', () => {
        const parser = new MTextParser('\\H2.5;First\\H.5x;Second');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('First');
        expect(tokens[0].ctx.capHeight).toBe(2.5);
        expect(tokens[1].type).toBe(TokenType.WORD);
        expect(tokens[1].data).toBe('Second');
        expect(tokens[1].ctx.capHeight).toBe(0.5);
      });

      it('handles height command with no value', () => {
        const parser = new MTextParser('\\H;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toBe(1.0); // Default value
      });
    });

    describe('width command', () => {
      it('parses absolute width values', () => {
        const parser = new MTextParser('\\W2.5;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toBe(2.5);
      });

      it('parses relative width values with x suffix', () => {
        const parser = new MTextParser('\\W2.5x;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toBe(2.5);
      });

      it('handles optional terminator', () => {
        const parser = new MTextParser('\\W2.5Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toBe(2.5);
      });

      it('handles leading signs', () => {
        let parser = new MTextParser('\\W-2.5;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toBe(2.5); // Negative values are ignored

        parser = new MTextParser('\\W+2.5;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toBe(2.5);
      });

      it('handles decimal values without leading zero', () => {
        let parser = new MTextParser('\\W.5x;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toBe(0.5);

        parser = new MTextParser('\\W-.5x;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toBe(0.5); // Negative values are ignored
      });

      it('handles multiple width commands', () => {
        const parser = new MTextParser('\\W2.5;First\\W.5x;Second');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('First');
        expect(tokens[0].ctx.widthFactor).toBe(2.5);
        expect(tokens[1].type).toBe(TokenType.WORD);
        expect(tokens[1].data).toBe('Second');
        expect(tokens[1].ctx.widthFactor).toBe(0.5);
      });
    });

    describe('character tracking command', () => {
      it('parses absolute tracking values', () => {
        const parser = new MTextParser('\\T2.5;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toBe(2.5);
      });

      it('parses relative tracking values with x suffix', () => {
        const parser = new MTextParser('\\T2.5x;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toBe(2.5);
      });

      it('handles optional terminator', () => {
        const parser = new MTextParser('\\T2.5Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toBe(2.5);
      });

      it('handles leading signs', () => {
        let parser = new MTextParser('\\T-2.5;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toBe(2.5); // Negative values are ignored

        parser = new MTextParser('\\T+2.5;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toBe(2.5);
      });

      it('handles decimal values without leading zero', () => {
        let parser = new MTextParser('\\T.5x;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toBe(0.5);

        parser = new MTextParser('\\T-.5x;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toBe(0.5); // Negative values are ignored
      });

      it('handles multiple tracking commands', () => {
        const parser = new MTextParser('\\T2.5;First\\T.5x;Second');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('First');
        expect(tokens[0].ctx.charTrackingFactor).toBe(2.5);
        expect(tokens[1].type).toBe(TokenType.WORD);
        expect(tokens[1].data).toBe('Second');
        expect(tokens[1].ctx.charTrackingFactor).toBe(0.5);
      });
    });

    describe('oblique command', () => {
      it('parses positive oblique angle', () => {
        const parser = new MTextParser('\\Q15;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.oblique).toBe(15);
      });

      it('parses negative oblique angle', () => {
        const parser = new MTextParser('\\Q-15;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.oblique).toBe(-15);
      });

      it('handles optional terminator', () => {
        const parser = new MTextParser('\\Q15Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.oblique).toBe(15);
      });

      it('handles decimal values', () => {
        const parser = new MTextParser('\\Q15.5;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.oblique).toBe(15.5);
      });

      it('handles multiple oblique commands', () => {
        const parser = new MTextParser('\\Q15;First\\Q-30;Second');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('First');
        expect(tokens[0].ctx.oblique).toBe(15);
        expect(tokens[1].type).toBe(TokenType.WORD);
        expect(tokens[1].data).toBe('Second');
        expect(tokens[1].ctx.oblique).toBe(-30);
      });
    });

    describe('special encoded characters', () => {
      it('renders diameter symbol (%%c)', () => {
        let parser = new MTextParser('%%cText');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('ØText');

        parser = new MTextParser('%%CText');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('ØText');
      });

      it('renders degree symbol (%%d)', () => {
        let parser = new MTextParser('%%dText');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('°Text');

        parser = new MTextParser('%%DText');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('°Text');
      });

      it('renders plus-minus symbol (%%p)', () => {
        let parser = new MTextParser('%%pText');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('±Text');

        parser = new MTextParser('%%PText');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('±Text');
      });

      it('handles multiple special characters in sequence', () => {
        const parser = new MTextParser('%%c%%d%%pText');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Ø°±Text');
      });

      it('handles special characters with spaces', () => {
        const parser = new MTextParser('%%c %%d %%p Text');
        const tokens = Array.from(parser.parse());
        expect(tokens).toHaveLength(7);
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Ø');
        expect(tokens[1].type).toBe(TokenType.SPACE);
        expect(tokens[2].type).toBe(TokenType.WORD);
        expect(tokens[2].data).toBe('°');
        expect(tokens[3].type).toBe(TokenType.SPACE);
        expect(tokens[4].type).toBe(TokenType.WORD);
        expect(tokens[4].data).toBe('±');
        expect(tokens[5].type).toBe(TokenType.SPACE);
        expect(tokens[6].type).toBe(TokenType.WORD);
        expect(tokens[6].data).toBe('Text');
      });

      it('handles special characters with formatting', () => {
        const parser = new MTextParser('\\H2.5;%%c\\H.5x;%%d%%p');
        const tokens = Array.from(parser.parse());
        expect(tokens).toHaveLength(2);
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Ø');
        expect(tokens[0].ctx.capHeight).toBe(2.5);
        expect(tokens[1].type).toBe(TokenType.WORD);
        expect(tokens[1].data).toBe('°±');
        expect(tokens[1].ctx.capHeight).toBe(0.5);
      });

      it('handles invalid special character codes', () => {
        const parser = new MTextParser('%%x%%y%%zText');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
      });
    });
  });

  describe('GBK character encoding', () => {
    it('decodes GBK hex codes', () => {
      // Test "你" (C4E3 in GBK)
      let parser = new MTextParser('\\M+C4E3', undefined, false);
      let tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('你');

      // Test "好" (BAC3 in GBK)
      parser = new MTextParser('\\M+BAC3', undefined, false);
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('好');

      // Test multiple GBK characters
      parser = new MTextParser('\\M+C4E3\\M+BAC3', undefined, false);
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('你');
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[1].data).toBe('好');
    });

    it('handles invalid GBK codes', () => {
      // Test invalid hex code
      let parser = new MTextParser('\\M+XXXX', undefined, false);
      let tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('\\M+XXXX');

      // Test incomplete hex code
      parser = new MTextParser('\\M+C4', undefined, false);
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('\\M+C4');

      // Test missing plus sign
      parser = new MTextParser('\\MC4E3', undefined, false);
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('\\MC4E3');
    });

    it('handles GBK characters with other formatting', () => {
      // Test GBK characters with height command
      const parser = new MTextParser('\\H2.5;\\M+C4E3\\H.5x;\\M+BAC3', undefined, false);
      const tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('你');
      expect(tokens[0].ctx.capHeight).toBe(2.5);
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[1].data).toBe('好');
      expect(tokens[1].ctx.capHeight).toBe(0.5);
    });

    it('handles GBK characters with font properties', () => {
      const parser = new MTextParser(
        '{\\fgbcbig.shx|b0|i0|c0|p0;\\M+C4E3\\M+BAC3}',
        undefined,
        false
      );
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('你');
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[1].data).toBe('好');
      expect(tokens[0].ctx.fontFace).toEqual({
        family: 'gbcbig.shx',
        style: 'Regular',
        weight: 400,
      });
      expect(tokens[1].ctx.fontFace).toEqual({
        family: 'gbcbig.shx',
        style: 'Regular',
        weight: 400,
      });
    });
  });

  describe('stacking', () => {
    it('parses basic fractions with different dividers', () => {
      let parser = new MTextParser('\\S1/2;');
      let tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1', '2', '/']);

      parser = new MTextParser('\\S1^ 2;');
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1', '2', '^']);

      parser = new MTextParser('\\S1#2;');
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1', '2', '#']);
    });

    it('handles spaces in numerator and denominator', () => {
      const parser = new MTextParser('\\S1 2/3 4;');
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1 2', '3 4', '/']);
    });

    it('handles spaces after / and # dividers', () => {
      let parser = new MTextParser('\\S1/ 2;');
      let tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1', ' 2', '/']);

      parser = new MTextParser('\\S1# 2;');
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1', ' 2', '#']);
    });

    it('handles escaped terminator', () => {
      const parser = new MTextParser('\\S1/2\\;;');
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1', '2;', '/']);
    });

    it('ignores backslashes except for escaped terminator', () => {
      const parser = new MTextParser('\\S\\N^ \\P;');
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['N', 'P', '^']);
    });

    it('renders grouping chars as simple braces', () => {
      const parser = new MTextParser('\\S{1}/2;');
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['{1}', '2', '/']);
    });

    it('decodes caret encoded chars', () => {
      let parser = new MTextParser('\\S^I/^J;');
      let tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual([' ', ' ', '/']);

      parser = new MTextParser('\\S^!/^?;');
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['▯', '▯', '/']);
    });

    it('handles multiple divider chars', () => {
      const parser = new MTextParser('\\S1/2/3;');
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1', '2/3', '/']);
    });

    it('requires terminator for command end', () => {
      const parser = new MTextParser('\\S1/2');
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1', '2', '/']);
    });

    it('handles complex fractions', () => {
      const parser = new MTextParser('\\S1 2/3 4^ 5 6;');
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1 2', '3 4^5 6', '/']);
    });
  });

  describe('paragraph properties', () => {
    it('parses indentation', () => {
      const parser = new MTextParser('\\pi2;Indented');
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('Indented');
      expect(tokens[0].ctx.paragraph.indent).toBe(2);
    });

    it('parses alignment', () => {
      const parser = new MTextParser('\\pqc;Centered');
      const tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toBe('Centered');
      expect(tokens[0].ctx.paragraph.align).toBe(MTextParagraphAlignment.CENTER);
    });
  });
});

describe('TextScanner', () => {
  let scanner: TextScanner;

  beforeEach(() => {
    scanner = new TextScanner('Hello World');
  });

  it('initializes with correct state', () => {
    expect(scanner.currentIndex).toBe(0);
    expect(scanner.isEmpty).toBe(false);
    expect(scanner.hasData).toBe(true);
  });

  it('consumes characters', () => {
    expect(scanner.get()).toBe('H');
    expect(scanner.currentIndex).toBe(1);
    expect(scanner.get()).toBe('e');
    expect(scanner.currentIndex).toBe(2);
  });

  it('peeks characters', () => {
    expect(scanner.peek()).toBe('H');
    expect(scanner.peek(1)).toBe('e');
    expect(scanner.currentIndex).toBe(0);
  });

  it('consumes multiple characters', () => {
    scanner.consume(5);
    expect(scanner.currentIndex).toBe(5);
    expect(scanner.get()).toBe(' ');
  });

  it('finds characters', () => {
    expect(scanner.find('W')).toBe(6);
    expect(scanner.find('X')).toBe(-1);
  });

  it('handles escaped characters in find', () => {
    scanner = new TextScanner('Hello\\;World');
    expect(scanner.find(';', true)).toBe(6);
  });

  it('gets remaining text', () => {
    scanner.consume(6);
    expect(scanner.tail).toBe('World');
  });

  it('handles end of text', () => {
    scanner.consume(11);
    expect(scanner.isEmpty).toBe(true);
    expect(scanner.hasData).toBe(false);
    expect(scanner.get()).toBe('');
    expect(scanner.peek()).toBe('');
  });
});
