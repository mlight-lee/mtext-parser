import { MTextParser, MTextToken, TokenType } from './parser';

// Example MText content with various formatting codes
const mtextContent = `
{\\fArial|b1|i0;This is a test of the MText parser\\P
\\C1;This text is red\\P
\\H2x;This text is twice the height\\P
\\S1/2;This is a fraction\\P
\\pi2,l4;This paragraph has indentation\\P
\\LThis text is underlined\\l\\P
\\OThis text has an overline\\o\\P
\\KThis text is struck through\\k\\P
\\Q15;This text is oblique\\P
\\T2;This text has increased tracking\\P
\\c16711680;This text is blue (RGB)\\P
%%c This is a diameter symbol\\P
%%d This is a degree symbol\\P
%%p This is a plus-minus symbol\\P
^I This is a tab\\P
^J This is a line break\\P
}`;

// Create a parser instance
const parser = new MTextParser(mtextContent);

// Process the tokens
for (const token of parser.parse()) {
  switch (token.type) {
    case TokenType.WORD:
      console.log('Word:', token.data);
      break;
    case TokenType.SPACE:
      console.log('Space');
      break;
    case TokenType.NEW_PARAGRAPH:
      console.log('New Paragraph');
      break;
    case TokenType.STACK:
      const [numerator, denominator, type] = token.data;
      console.log('Stack:', { numerator, denominator, type });
      break;
    case TokenType.PROPERTIES_CHANGED:
      console.log('Properties Changed:', token.data);
      break;
    case TokenType.NBSP:
      console.log('Non-breaking space');
      break;
    case TokenType.TABULATOR:
      console.log('Tab');
      break;
    case TokenType.NEW_COLUMN:
      console.log('New Column');
      break;
    case TokenType.WRAP_AT_DIMLINE:
      console.log('Wrap at dimension line');
      break;
  }

  // Log the current context state
  console.log('Context:', {
    font: token.ctx.fontFace,
    color: token.ctx.rgb ? `RGB(${token.ctx.rgb.join(',')})` : `ACI(${token.ctx.aci})`,
    height: token.ctx.capHeight,
    width: token.ctx.widthFactor,
    tracking: token.ctx.charTrackingFactor,
    oblique: token.ctx.oblique,
    underline: token.ctx.underline,
    overline: token.ctx.overline,
    strikeThrough: token.ctx.strikeThrough,
    paragraph: token.ctx.paragraph,
  });
  console.log('---');
}
