import { MTextParser, TokenType, MTextContext } from './parser';

// Example 1: Basic text with formatting
const basicExample = `
This is a test of the MText parser\\P
\\C1;This text is red\\P
\\H2x;This text is twice the height\\P
\\S1/2;This is a fraction\\P
`;

// Example 2: Paragraph formatting
const paragraphExample = `
\\pi2,l4;This paragraph has indentation\\P
\\pqc;This paragraph is centered\\P
\\pqr;This paragraph is right-aligned\\P
`;

// Example 3: Text styling
const stylingExample = `
\\LThis text is underlined\\l\\P
\\OThis text has an overline\\o\\P
\\KThis text is struck through\\k\\P
\\Q15;This text is oblique\\P
\\T2;This text has increased tracking\\P
`;

// Example 4: Colors and special characters
const colorExample = `
\\c16711680;This text is blue (RGB)\\P
%%c This is a diameter symbol\\P
%%d This is a degree symbol\\P
%%p This is a plus-minus symbol\\P
`;

// Example 5: Caret encoded characters
const caretExample = `
^I This is a tab\\P
^J This is a line break\\P
1^ 2 This shows a caret\\P
`;

// Example 6: Complex formatting with context
const complexExample = `
{\\fArial|b1|i0;
  This text is in Arial Bold\\P
  \\H2.5;This text is larger\\P
  \\H.5x;This text is smaller\\P
}
`;

// Function to process tokens and display their properties
function processTokens(parser: MTextParser, title: string) {
  console.log(`\n=== ${title} ===\n`);

  for (const token of parser.parse()) {
    // Print token type and data
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
      case TokenType.STACK: {
        const [numerator, denominator, type] = token.data as [string, string, string];
        console.log('Stack:', { numerator, denominator, type });
        break;
      }
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

    // Print context properties if they differ from defaults
    const ctx = token.ctx;
    const contextProps = {
      font: ctx.fontFace.family ? ctx.fontFace : undefined,
      color: ctx.color.isRgb
        ? `RGB(${ctx.color.rgb!.join(',')}) [${ctx.color.rgbValue?.toString(16)}]`
        : ctx.color.aci !== null
          ? `ACI(${ctx.color.aci})`
          : undefined,
      height:
        ctx.capHeight.value !== 1.0
          ? `${ctx.capHeight.value}${ctx.capHeight.isRelative ? 'x' : ''}`
          : undefined,
      width:
        ctx.widthFactor.value !== 1.0
          ? `${ctx.widthFactor.value}${ctx.widthFactor.isRelative ? 'x' : ''}`
          : undefined,
      tracking: ctx.charTrackingFactor.value !== 1.0 ? ctx.charTrackingFactor : undefined,
      oblique: ctx.oblique !== 0.0 ? ctx.oblique : undefined,
      underline: ctx.underline ? true : undefined,
      overline: ctx.overline ? true : undefined,
      strikeThrough: ctx.strikeThrough ? true : undefined,
      paragraph: Object.keys(ctx.paragraph).some(
        key =>
          ctx.paragraph[key as keyof typeof ctx.paragraph] !==
          new MTextContext().paragraph[key as keyof typeof ctx.paragraph]
      )
        ? ctx.paragraph
        : undefined,
    };

    // Only print non-default context properties
    const nonDefaultProps = Object.entries(contextProps)
      .filter(([_, value]) => value !== undefined)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

    if (Object.keys(nonDefaultProps).length > 0) {
      console.log('Context:', nonDefaultProps);
    }
    console.log('---');
  }
}

// Process all examples
processTokens(new MTextParser(basicExample), 'Basic Formatting');
processTokens(new MTextParser(paragraphExample), 'Paragraph Formatting');
processTokens(new MTextParser(stylingExample), 'Text Styling');
processTokens(new MTextParser(colorExample), 'Colors and Special Characters');
processTokens(new MTextParser(caretExample), 'Caret Encoded Characters');
processTokens(new MTextParser(complexExample), 'Complex Formatting with Context');

// Example of using custom context
const customContext = new MTextContext();
customContext.capHeight = { value: 2.0, isRelative: false };
customContext.widthFactor = { value: 1.5, isRelative: true };
customContext.fontFace = { family: 'Times New Roman', style: 'Italic', weight: 400 };

const customParser = new MTextParser('Text with custom context', customContext);
processTokens(customParser, 'Custom Context');

// Example of parsing with property commands
const propertyParser = new MTextParser('\\C1;Red Text', undefined, { yieldPropertyCommands: true });
processTokens(propertyParser, 'Property Commands');
