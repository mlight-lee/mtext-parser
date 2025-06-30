import {
  MTextParser,
  MTextContext,
  TokenType,
  MTextLineAlignment,
  MTextParagraphAlignment,
  rgb2int,
  int2rgb,
  escapeDxfLineEndings,
  hasInlineFormattingCodes,
  TextScanner,
  getFonts,
  MTextColor,
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
    expect(ctx.aci).toBe(256);
    expect(ctx.rgb).toBeNull();
    expect(ctx.align).toBe(MTextLineAlignment.BOTTOM);
    expect(ctx.fontFace).toEqual({ family: '', style: 'Regular', weight: 400 });
    expect(ctx.capHeight).toEqual({ value: 1.0, isRelative: false });
    expect(ctx.widthFactor).toEqual({ value: 1.0, isRelative: false });
    expect(ctx.charTrackingFactor).toEqual({ value: 1.0, isRelative: false });
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
      expect(ctx.color.aci).toBe(1);
      expect(ctx.color.rgb).toBeNull();
      expect(ctx.color.rgbValue).toBeNull();
      expect(() => (ctx.aci = 257)).toThrow('ACI not in range [0, 256]');
    });

    it('handles RGB color', () => {
      ctx.rgb = [255, 0, 0];
      expect(ctx.rgb).toEqual([255, 0, 0]);
      expect(ctx.color.rgb).toEqual([255, 0, 0]);
      expect(ctx.color.aci).toBeNull();
      expect(ctx.color.rgbValue).toBe(0xff0000);
    });

    it('switches from RGB to ACI', () => {
      ctx.rgb = [255, 0, 0];
      ctx.aci = 2;
      expect(ctx.rgb).toBeNull();
      expect(ctx.aci).toBe(2);
      expect(ctx.color.rgb).toBeNull();
      expect(ctx.color.aci).toBe(2);
      expect(ctx.color.rgbValue).toBeNull();
    });

    it('handles RGB value set directly', () => {
      ctx.color.rgbValue = 0x00ff00;
      expect(ctx.rgb).toEqual([0, 255, 0]);
      expect(ctx.color.rgb).toEqual([0, 255, 0]);
      expect(ctx.color.rgbValue).toBe(0x00ff00);
      expect(ctx.color.aci).toBeNull();
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
      expect(copy.color.rgb).toEqual(ctx.color.rgb);
      expect(copy.color.aci).toBe(ctx.color.aci);
      expect(copy.color.rgbValue).toBe(ctx.color.rgbValue);
      expect(copy.fontFace).toEqual(ctx.fontFace);
      expect(copy.paragraph).toEqual(ctx.paragraph);
      // Changing the copy's color should not affect the original
      copy.rgb = [0, 255, 0];
      expect(ctx.rgb).toEqual([255, 0, 0]);
      expect(copy.rgb).toEqual([0, 255, 0]);
      expect(copy.color.rgbValue).toBe(0x00ff00);
      expect(ctx.color.rgbValue).toBe(0xff0000);
    });
  });

  describe('factor properties', () => {
    it('handles charTrackingFactor absolute values', () => {
      ctx.charTrackingFactor = { value: 2.0, isRelative: false };
      expect(ctx.charTrackingFactor).toEqual({ value: 2.0, isRelative: false });

      ctx.charTrackingFactor = { value: 0.5, isRelative: false };
      expect(ctx.charTrackingFactor).toEqual({ value: 0.5, isRelative: false });
    });

    it('handles charTrackingFactor relative values', () => {
      ctx.charTrackingFactor = { value: 2.0, isRelative: true };
      expect(ctx.charTrackingFactor).toEqual({ value: 2.0, isRelative: true });

      ctx.charTrackingFactor = { value: 0.5, isRelative: true };
      expect(ctx.charTrackingFactor).toEqual({ value: 0.5, isRelative: true });
    });

    it('converts negative values to positive for charTrackingFactor', () => {
      ctx.charTrackingFactor = { value: -2.0, isRelative: false };
      expect(ctx.charTrackingFactor).toEqual({ value: 2.0, isRelative: false });

      ctx.charTrackingFactor = { value: -0.5, isRelative: true };
      expect(ctx.charTrackingFactor).toEqual({ value: 0.5, isRelative: true });
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
        expect(tokens[0].ctx.capHeight).toEqual({ value: 2.5, isRelative: false });
      });

      it('parses relative height values with x suffix', () => {
        const parser = new MTextParser('\\H2.5x;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 2.5, isRelative: true });
      });

      it('handles optional terminator', () => {
        const parser = new MTextParser('\\H2.5Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 2.5, isRelative: false });
      });

      it('handles leading signs', () => {
        let parser = new MTextParser('\\H-2.5;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 2.5, isRelative: false }); // Negative values are ignored

        parser = new MTextParser('\\H+2.5;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 2.5, isRelative: false });
      });

      it('handles decimal values without leading zero', () => {
        let parser = new MTextParser('\\H.5x;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 0.5, isRelative: true });

        parser = new MTextParser('\\H-.5x;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 0.5, isRelative: true }); // Negative values are ignored

        parser = new MTextParser('\\H+.5x;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 0.5, isRelative: true });
      });

      it('handles exponential notation', () => {
        let parser = new MTextParser('\\H1e2;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 100, isRelative: false });

        parser = new MTextParser('\\H1e-2;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 0.01, isRelative: false });

        parser = new MTextParser('\\H.5e2;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 50, isRelative: false });

        parser = new MTextParser('\\H.5e-2;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 0.005, isRelative: false });
      });

      it('handles invalid floating point values', () => {
        let parser = new MTextParser('\\H1..5;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('.5;Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 1.0, isRelative: false }); // Default value

        parser = new MTextParser('\\H1e;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('e;Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 1.0, isRelative: false }); // Default value

        parser = new MTextParser('\\H1e+;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('e+;Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 1.0, isRelative: false }); // Default value
      });

      it('handles complex height expressions', () => {
        let parser = new MTextParser('\\H+1.5e-1x;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 0.15, isRelative: true });

        parser = new MTextParser('\\H-.5e+2x;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 50, isRelative: true }); // Negative values are ignored
      });

      it('handles multiple height commands', () => {
        const parser = new MTextParser('\\H2.5;First\\H.5x;Second');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('First');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 2.5, isRelative: false });
        expect(tokens[1].type).toBe(TokenType.WORD);
        expect(tokens[1].data).toBe('Second');
        expect(tokens[1].ctx.capHeight).toEqual({ value: 0.5, isRelative: true });
      });

      it('handles height command with no value', () => {
        const parser = new MTextParser('\\H;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.capHeight).toEqual({ value: 1.0, isRelative: false }); // Default value
      });
    });

    describe('width command', () => {
      it('parses absolute width values', () => {
        const parser = new MTextParser('\\W2.5;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toEqual({ value: 2.5, isRelative: false });
      });

      it('parses relative width values with x suffix', () => {
        const parser = new MTextParser('\\W2.5x;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toEqual({ value: 2.5, isRelative: true });
      });

      it('handles optional terminator', () => {
        const parser = new MTextParser('\\W2.5Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toEqual({ value: 2.5, isRelative: false });
      });

      it('handles leading signs', () => {
        let parser = new MTextParser('\\W-2.5;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toEqual({ value: 2.5, isRelative: false }); // Negative values are ignored

        parser = new MTextParser('\\W+2.5;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toEqual({ value: 2.5, isRelative: false });
      });

      it('handles decimal values without leading zero', () => {
        let parser = new MTextParser('\\W.5x;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toEqual({ value: 0.5, isRelative: true });

        parser = new MTextParser('\\W-.5x;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.widthFactor).toEqual({ value: 0.5, isRelative: true }); // Negative values are ignored
      });

      it('handles multiple width commands', () => {
        const parser = new MTextParser('\\W2.5;First\\W.5x;Second');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('First');
        expect(tokens[0].ctx.widthFactor).toEqual({ value: 2.5, isRelative: false });
        expect(tokens[1].type).toBe(TokenType.WORD);
        expect(tokens[1].data).toBe('Second');
        expect(tokens[1].ctx.widthFactor).toEqual({ value: 0.5, isRelative: true });
      });
    });

    describe('character tracking command', () => {
      it('parses absolute tracking values', () => {
        const parser = new MTextParser('\\T2.5;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toEqual({ value: 2.5, isRelative: false });
      });

      it('parses relative tracking values with x suffix', () => {
        const parser = new MTextParser('\\T2.5x;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toEqual({ value: 2.5, isRelative: true });
      });

      it('handles optional terminator', () => {
        const parser = new MTextParser('\\T2.5Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toEqual({ value: 2.5, isRelative: false });
      });

      it('handles leading signs', () => {
        let parser = new MTextParser('\\T-2.5;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toEqual({ value: 2.5, isRelative: false }); // Negative values are ignored

        parser = new MTextParser('\\T+2.5;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toEqual({ value: 2.5, isRelative: false });
      });

      it('handles decimal values without leading zero', () => {
        let parser = new MTextParser('\\T.5x;Text');
        let tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toEqual({ value: 0.5, isRelative: true });

        parser = new MTextParser('\\T-.5x;Text');
        tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toEqual({ value: 0.5, isRelative: true }); // Negative values are ignored
      });

      it('handles multiple tracking commands', () => {
        const parser = new MTextParser('\\T2.5;First\\T.5x;Second');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('First');
        expect(tokens[0].ctx.charTrackingFactor).toEqual({ value: 2.5, isRelative: false });
        expect(tokens[1].type).toBe(TokenType.WORD);
        expect(tokens[1].data).toBe('Second');
        expect(tokens[1].ctx.charTrackingFactor).toEqual({ value: 0.5, isRelative: true });
      });

      it('handles tracking command with no value', () => {
        const parser = new MTextParser('\\T;Text');
        const tokens = Array.from(parser.parse());
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].data).toBe('Text');
        expect(tokens[0].ctx.charTrackingFactor).toEqual({ value: 1.0, isRelative: false }); // Default value
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
        expect(tokens[0].ctx.capHeight).toEqual({ value: 2.5, isRelative: false });
        expect(tokens[1].type).toBe(TokenType.WORD);
        expect(tokens[1].data).toBe('°±');
        expect(tokens[1].ctx.capHeight).toEqual({ value: 0.5, isRelative: true });
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
      expect(tokens[0].ctx.capHeight).toEqual({ value: 2.5, isRelative: false });
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[1].data).toBe('好');
      expect(tokens[1].ctx.capHeight).toEqual({ value: 0.5, isRelative: true });
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

      parser = new MTextParser('\\S1#2;');
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1', '2', '#']);
    });

    it('handles caret for baseline alignment', () => {
      let parser = new MTextParser('\\S1^2;');
      let tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1', '2', '^']);

      // Test with spaces
      parser = new MTextParser('\\S1 2^3 4;');
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1 2', '3 4', '^']);

      // Test with escaped characters
      parser = new MTextParser('\\S1^2\\;;');
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['1', '2;', '^']);
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

    it('treats carets in stack formatting as literal text', () => {
      let parser = new MTextParser('\\S^I/^J;');
      let tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual([' ', ' ', '/']);

      parser = new MTextParser('\\Sabc^def;');
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.STACK);
      expect(tokens[0].data).toEqual(['abc', 'def', '^']);
    });

    it('handles subscript and superscript', () => {
      // Subscript
      let parser = new MTextParser('abc\\S^ 1;');
      let tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toEqual('abc');
      expect(tokens[1].type).toBe(TokenType.STACK);
      expect(tokens[1].data).toEqual(['', '1', '^']);

      // Superscript
      parser = new MTextParser('abc\\S1^ ;');
      tokens = Array.from(parser.parse());
      expect(tokens[0].type).toBe(TokenType.WORD);
      expect(tokens[0].data).toEqual('abc');
      expect(tokens[1].type).toBe(TokenType.STACK);
      expect(tokens[1].data).toEqual(['1', '', '^']);
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
      expect(tokens[0].data).toEqual(['1 2', '3 4^ 5 6', '/']);
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

  describe('property commands with yieldPropertyCommands', () => {
    it('yields property change tokens for formatting commands', () => {
      const parser = new MTextParser('\\LUnderlined\\l', undefined, true);
      const tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(3);
      expect(tokens[0].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[0].data).toEqual({
        command: 'L',
        changes: {
          underline: true,
        },
      });
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[1].data).toBe('Underlined');
      expect(tokens[1].ctx.underline).toBe(true);
      expect(tokens[2].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[2].data).toEqual({
        command: 'l',
        changes: {
          underline: false,
        },
      });
      expect(tokens[2].ctx.underline).toBe(false);
    });

    it('yields property change tokens for color commands', () => {
      const parser = new MTextParser('\\C1Red Text', undefined, true);
      const tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(4);
      expect(tokens[0].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[0].data).toEqual({
        command: 'C',
        changes: {
          aci: 1,
        },
      });
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[1].data).toBe('Red');
      expect(tokens[1].ctx.aci).toBe(1);
      expect(tokens[2].type).toBe(TokenType.SPACE);
      expect(tokens[2].ctx.aci).toBe(1);
      expect(tokens[3].type).toBe(TokenType.WORD);
      expect(tokens[3].data).toBe('Text');
      expect(tokens[3].ctx.aci).toBe(1);
    });

    it('yields property change tokens for font properties', () => {
      const parser = new MTextParser('\\FArial|b1|i1;Bold Italic', undefined, true);
      const tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(4);
      expect(tokens[0].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[0].data).toEqual({
        command: 'F',
        changes: {
          fontFace: {
            family: 'Arial',
            style: 'Italic',
            weight: 700,
          },
        },
      });
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[1].data).toBe('Bold');
      expect(tokens[1].ctx.fontFace).toEqual({
        family: 'Arial',
        style: 'Italic',
        weight: 700,
      });
      expect(tokens[2].type).toBe(TokenType.SPACE);
      expect(tokens[2].ctx.fontFace).toEqual({
        family: 'Arial',
        style: 'Italic',
        weight: 700,
      });
      expect(tokens[3].type).toBe(TokenType.WORD);
      expect(tokens[3].data).toBe('Italic');
      expect(tokens[3].ctx.fontFace).toEqual({
        family: 'Arial',
        style: 'Italic',
        weight: 700,
      });
    });

    it('yields property change tokens for height command', () => {
      const parser = new MTextParser('\\H2.5;Text', undefined, true);
      const tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[0].data).toEqual({
        command: 'H',
        changes: {
          capHeight: { value: 2.5, isRelative: false },
        },
      });
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[1].data).toBe('Text');
      expect(tokens[1].ctx.capHeight).toEqual({ value: 2.5, isRelative: false });
    });

    it('yields property change tokens for multiple commands', () => {
      const parser = new MTextParser('\\H2.5;\\C1;\\LText\\l', undefined, true);
      const tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(5);
      expect(tokens[0].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[0].data).toEqual({
        command: 'H',
        changes: {
          capHeight: { value: 2.5, isRelative: false },
        },
      });
      expect(tokens[1].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[1].data).toEqual({
        command: 'C',
        changes: {
          aci: 1,
        },
      });
      expect(tokens[2].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[2].data).toEqual({
        command: 'L',
        changes: {
          underline: true,
        },
      });
      expect(tokens[3].type).toBe(TokenType.WORD);
      expect(tokens[3].data).toBe('Text');
      expect(tokens[3].ctx.capHeight).toEqual({ value: 2.5, isRelative: false });
      expect(tokens[3].ctx.aci).toBe(1);
      expect(tokens[3].ctx.underline).toBe(true);
      expect(tokens[4].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[4].data).toEqual({
        command: 'l',
        changes: {
          underline: false,
        },
      });
    });

    it('yields property change tokens for paragraph properties', () => {
      const parser = new MTextParser('\\pi2;\\pqc;Indented Centered', undefined, true);
      const tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(5);
      expect(tokens[0].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[0].data).toEqual({
        command: 'p',
        changes: {
          paragraph: {
            indent: 2,
          },
        },
      });
      expect(tokens[1].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[1].data).toEqual({
        command: 'p',
        changes: {
          paragraph: {
            align: MTextParagraphAlignment.CENTER,
          },
        },
      });
      expect(tokens[2].type).toBe(TokenType.WORD);
      expect(tokens[2].data).toBe('Indented');
      expect(tokens[2].ctx.paragraph.indent).toBe(2);
      expect(tokens[2].ctx.paragraph.align).toBe(MTextParagraphAlignment.CENTER);
      expect(tokens[3].type).toBe(TokenType.SPACE);
      expect(tokens[3].ctx.paragraph.align).toBe(MTextParagraphAlignment.CENTER);
      expect(tokens[4].type).toBe(TokenType.WORD);
      expect(tokens[4].data).toBe('Centered');
      expect(tokens[4].ctx.paragraph.align).toBe(MTextParagraphAlignment.CENTER);
    });

    it('yields property change tokens for complex formatting', () => {
      const parser = new MTextParser(
        '{\\H2.5;\\C1;\\FArial|b1|i1;Formatted Text}',
        undefined,
        true
      );
      const tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(7);
      expect(tokens[0].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[0].data).toEqual({
        command: 'H',
        changes: {
          capHeight: { value: 2.5, isRelative: false },
        },
      });
      expect(tokens[1].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[1].data).toEqual({
        command: 'C',
        changes: {
          aci: 1,
        },
      });
      expect(tokens[2].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[2].data).toEqual({
        command: 'F',
        changes: {
          fontFace: {
            family: 'Arial',
            style: 'Italic',
            weight: 700,
          },
        },
      });
      expect(tokens[3].type).toBe(TokenType.WORD);
      expect(tokens[3].data).toBe('Formatted');
      expect(tokens[3].ctx.capHeight).toEqual({ value: 2.5, isRelative: false });
      expect(tokens[3].ctx.aci).toBe(1);
      expect(tokens[3].ctx.fontFace).toEqual({
        family: 'Arial',
        style: 'Italic',
        weight: 700,
      });
      expect(tokens[4].type).toBe(TokenType.SPACE);
      expect(tokens[4].ctx.fontFace).toEqual({
        family: 'Arial',
        style: 'Italic',
        weight: 700,
      });
      expect(tokens[5].type).toBe(TokenType.WORD);
      expect(tokens[5].data).toBe('Text');
      expect(tokens[5].ctx.fontFace).toEqual({
        family: 'Arial',
        style: 'Italic',
        weight: 700,
      });
      expect(tokens[6].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[6].data).toEqual({
        command: undefined,
        changes: {
          aci: 256,
          capHeight: { value: 1, isRelative: false },
          fontFace: { family: '', style: 'Regular', weight: 400 },
        },
      });
    });
  });

  describe('MTextParser context restoration with braces {}', () => {
    it('scopes font formatting to braces and restores after', () => {
      const parser = new MTextParser('Normal {\\fArial|i;Italic} Back to normal');
      const tokens = Array.from(parser.parse()).filter(t => t.type === TokenType.WORD);
      expect(tokens[0].data).toBe('Normal');
      expect(tokens[0].ctx.fontFace).toEqual({ family: '', style: 'Regular', weight: 400 });
      expect(tokens[1].data).toBe('Italic');
      expect(tokens[1].ctx.fontFace).toEqual({ family: 'Arial', style: 'Italic', weight: 400 });
      expect(tokens[2].data).toBe('Back');
      expect(tokens[2].ctx.fontFace).toEqual({ family: '', style: 'Regular', weight: 400 });
    });

    it('scopes color formatting to braces and restores after', () => {
      const parser = new MTextParser('{\\C1;Red} Normal');
      const tokens = Array.from(parser.parse()).filter(t => t.type === TokenType.WORD);
      expect(tokens[0].data).toBe('Red');
      expect(tokens[0].ctx.aci).toBe(1);
      expect(tokens[1].data).toBe('Normal');
      expect(tokens[1].ctx.aci).toBe(256); // default
    });

    it('restores previous formatting after a formatting block', () => {
      const parser = new MTextParser('\\C2;Before {\\C1;Red} After');
      const tokens = Array.from(parser.parse()).filter(t => t.type === TokenType.WORD);
      expect(tokens[0].data).toBe('Before');
      expect(tokens[0].ctx.aci).toBe(2);
      expect(tokens[1].data).toBe('Red');
      expect(tokens[1].ctx.aci).toBe(1);
      expect(tokens[2].data).toBe('After');
      expect(tokens[2].ctx.aci).toBe(2);
    });

    it('restores context correctly with nested braces', () => {
      const parser = new MTextParser('{\\C1;Red {\\C2;Blue} RedAgain}');
      const tokens = Array.from(parser.parse()).filter(t => t.type === TokenType.WORD);
      expect(tokens[0].data).toBe('Red');
      expect(tokens[0].ctx.aci).toBe(1);
      expect(tokens[1].data).toBe('Blue');
      expect(tokens[1].ctx.aci).toBe(2);
      expect(tokens[2].data).toBe('RedAgain');
      expect(tokens[2].ctx.aci).toBe(1);
    });

    it('persists formatting outside braces if not reset', () => {
      const parser = new MTextParser('\\C3;All {\\C1;Red} StillAll');
      const tokens = Array.from(parser.parse()).filter(t => t.type === TokenType.WORD);
      expect(tokens[0].data).toBe('All');
      expect(tokens[0].ctx.aci).toBe(3);
      expect(tokens[1].data).toBe('Red');
      expect(tokens[1].ctx.aci).toBe(1);
      expect(tokens[2].data).toBe('StillAll');
      expect(tokens[2].ctx.aci).toBe(3);
    });
  });

  describe('MTextParser context restoration with braces {} and yieldPropertyCommands', () => {
    it('yields property change tokens when entering and exiting a formatting block', () => {
      const parser = new MTextParser('Normal {\\fArial|i;Italic} Back', undefined, true);
      const tokens = Array.from(parser.parse());
      // Filter for property changes and words
      const propTokens = tokens.filter(t => t.type === TokenType.PROPERTIES_CHANGED);
      const wordTokens = tokens.filter(t => t.type === TokenType.WORD);
      // Should yield a property change for entering Arial Italic
      expect(propTokens[0].data).toEqual({
        command: 'f',
        changes: { fontFace: { family: 'Arial', style: 'Italic', weight: 400 } },
      });
      // Should yield a property change for restoring default font after block
      expect(propTokens[propTokens.length - 1].data).toEqual({
        command: undefined,
        changes: { fontFace: { family: '', style: 'Regular', weight: 400 } },
      });
      // Check word tokens context
      expect(wordTokens[0].data).toBe('Normal');
      expect(wordTokens[0].ctx.fontFace).toEqual({ family: '', style: 'Regular', weight: 400 });
      expect(wordTokens[1].data).toBe('Italic');
      expect(wordTokens[1].ctx.fontFace).toEqual({ family: 'Arial', style: 'Italic', weight: 400 });
      expect(wordTokens[2].data).toBe('Back');
      expect(wordTokens[2].ctx.fontFace).toEqual({ family: '', style: 'Regular', weight: 400 });
    });

    it('yields property change tokens for color and restores after block', () => {
      const parser = new MTextParser('{\\C1;Red} Normal', undefined, true);
      const tokens = Array.from(parser.parse());
      const propTokens = tokens.filter(t => t.type === TokenType.PROPERTIES_CHANGED);
      const wordTokens = tokens.filter(t => t.type === TokenType.WORD);
      expect(propTokens[0].data).toEqual({ command: 'C', changes: { aci: 1 } });
      expect(propTokens[propTokens.length - 1].data).toEqual({
        command: undefined,
        changes: { aci: 256 },
      });
      expect(wordTokens[0].data).toBe('Red');
      expect(wordTokens[0].ctx.aci).toBe(1);
      expect(wordTokens[1].data).toBe('Normal');
      expect(wordTokens[1].ctx.aci).toBe(256);
    });

    it('yields property change tokens for nested braces', () => {
      const parser = new MTextParser('{\\C1;Red {\\C2;Blue} RedAgain}', undefined, true);
      const tokens = Array.from(parser.parse());
      const propTokens = tokens.filter(t => t.type === TokenType.PROPERTIES_CHANGED);
      const wordTokens = tokens.filter(t => t.type === TokenType.WORD);
      // Enter C1
      expect(propTokens[0].data).toEqual({ command: 'C', changes: { aci: 1 } });
      // Enter C2
      expect(propTokens[1].data).toEqual({ command: 'C', changes: { aci: 2 } });
      // Exit C2 (restore C1)
      expect(propTokens[2].data).toEqual({ command: undefined, changes: { aci: 1 } });
      // Exit C1 (restore default)
      expect(propTokens[propTokens.length - 1].data).toEqual({
        command: undefined,
        changes: { aci: 256 },
      });
      expect(wordTokens[0].data).toBe('Red');
      expect(wordTokens[0].ctx.aci).toBe(1);
      expect(wordTokens[1].data).toBe('Blue');
      expect(wordTokens[1].ctx.aci).toBe(2);
      expect(wordTokens[2].data).toBe('RedAgain');
      expect(wordTokens[2].ctx.aci).toBe(1);
    });

    it('yields property change tokens for RGB color commands', () => {
      // \c16711680 is 0xFF0000, which is [255,0,0] (red)
      const parser = new MTextParser('\\c16711680Red Text', undefined, true);
      const tokens = Array.from(parser.parse());
      expect(tokens).toHaveLength(4);
      expect(tokens[0].type).toBe(TokenType.PROPERTIES_CHANGED);
      expect(tokens[0].data).toEqual({
        command: 'c',
        changes: {
          aci: null,
          rgb: [255, 0, 0],
        },
      });
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[1].data).toBe('Red');
      expect(tokens[1].ctx.rgb).toEqual([255, 0, 0]);
      expect(tokens[2].type).toBe(TokenType.SPACE);
      expect(tokens[2].ctx.rgb).toEqual([255, 0, 0]);
      expect(tokens[3].type).toBe(TokenType.WORD);
      expect(tokens[3].data).toBe('Text');
      expect(tokens[3].ctx.rgb).toEqual([255, 0, 0]);
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

describe('getFonts', () => {
  it('should return empty set for empty string', () => {
    const result = getFonts('');
    expect(result).toEqual(new Set());
  });

  it('should extract single font name', () => {
    const result = getFonts('\\fArial|Hello World');
    expect(result).toEqual(new Set(['arial']));
  });

  it('should extract multiple unique font names', () => {
    const result = getFonts('\\fArial|Hello \\fTimes New Roman|World');
    expect(result).toEqual(new Set(['arial', 'times new roman']));
  });

  it('should handle case-insensitive font names', () => {
    const result = getFonts('\\fARIAL|Hello \\fArial|World');
    expect(result).toEqual(new Set(['arial']));
  });

  it('should handle font names with spaces', () => {
    const result = getFonts('\\fTimes New Roman|Hello \\fComic Sans MS|World');
    expect(result).toEqual(new Set(['times new roman', 'comic sans ms']));
  });

  it('should handle multiple font changes in sequence', () => {
    const result = getFonts('\\fArial|Hello \\fTimes New Roman|World \\fArial|Again');
    expect(result).toEqual(new Set(['arial', 'times new roman']));
  });

  it('should handle font names with special characters', () => {
    const result = getFonts('\\fArial-Bold|Hello \\fTimes-New-Roman|World');
    expect(result).toEqual(new Set(['arial-bold', 'times-new-roman']));
  });

  it('should handle both lowercase and uppercase font commands', () => {
    const result = getFonts('\\fArial|Hello \\FTimes New Roman|World');
    expect(result).toEqual(new Set(['arial', 'times new roman']));
  });

  it('should handle complex MText with semicolon terminators', () => {
    const mtext =
      '{\\C1;\\W2;\\FSimSun;SimSun Text}\\P{\\C2;\\W0.5;\\FArial;Arial Text}\\P{\\C3;\\O30;\\FRomans;Romans Text}\\P{\\C4;\\Q1;\\FSimHei;SimHei Text}\\P{\\C5;\\Q0.5;\\FSimKai;SimKai Text}';
    const result = getFonts(mtext);
    expect(result).toEqual(new Set(['simsun', 'arial', 'romans', 'simhei', 'simkai']));
  });

  it('should preserve font extensions when removeExtension is false', () => {
    const mtext = '\\fArial.ttf|Hello \\fTimes New Roman.otf|World';
    const result = getFonts(mtext, false);
    expect(result).toEqual(new Set(['arial.ttf', 'times new roman.otf']));
  });

  it('should remove font extensions when removeExtension is true', () => {
    const mtext = '\\fArial.ttf|Hello \\fTimes New Roman.otf|World';
    const result = getFonts(mtext, true);
    expect(result).toEqual(new Set(['arial', 'times new roman']));
  });

  it('should handle various font extensions', () => {
    const mtext = '\\fFont1.ttf|Text1 \\fFont2.otf|Text2 \\fFont3.woff|Text3 \\fFont4.shx|Text4';
    const result = getFonts(mtext, true);
    expect(result).toEqual(new Set(['font1', 'font2', 'font3', 'font4']));
  });

  it('should not remove non-font extensions', () => {
    const mtext = '\\fFont1.txt|Text1 \\fFont2.doc|Text2';
    const result = getFonts(mtext, true);
    expect(result).toEqual(new Set(['font1.txt', 'font2.doc']));
  });
});

describe('MTextColor', () => {
  it('defaults to ACI 256 (by layer)', () => {
    const color = new MTextColor();
    expect(color.aci).toBe(256);
    expect(color.rgb).toBeNull();
    expect(color.isAci).toBe(true);
    expect(color.isRgb).toBe(false);
  });

  it('can be constructed with ACI', () => {
    const color = new MTextColor(1);
    expect(color.aci).toBe(1);
    expect(color.rgb).toBeNull();
    expect(color.isAci).toBe(true);
    expect(color.isRgb).toBe(false);
  });

  it('can be constructed with RGB', () => {
    const color = new MTextColor([255, 0, 0]);
    expect(color.aci).toBeNull();
    expect(color.rgb).toEqual([255, 0, 0]);
    expect(color.isAci).toBe(false);
    expect(color.isRgb).toBe(true);
  });

  it('switches from ACI to RGB and back', () => {
    const color = new MTextColor(2);
    expect(color.aci).toBe(2);
    color.rgb = [0, 255, 0];
    expect(color.aci).toBeNull();
    expect(color.rgb).toEqual([0, 255, 0]);
    color.aci = 7;
    expect(color.aci).toBe(7);
    expect(color.rgb).toBeNull();
  });

  it('copy() produces a deep copy', () => {
    const color = new MTextColor([1, 2, 3]);
    const copy = color.copy();
    expect(copy).not.toBe(color);
    expect(copy.aci).toBe(color.aci);
    expect(copy.rgb).toEqual(color.rgb);
    copy.rgb = [4, 5, 6];
    expect(color.rgb).toEqual([1, 2, 3]);
    expect(copy.rgb).toEqual([4, 5, 6]);
  });
});
