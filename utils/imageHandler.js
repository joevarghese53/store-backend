import sharp from "sharp";

function buildPrompt(userPrompt, shirtColor) {
  return `${userPrompt} — in a detailed flat retro illustration style on ${shirtColor} background, generate a short catchy retro phrase of 2–5 words inspired by the topic. Choose a color palette that gives contrast on ${shirtColor}. Bold graphic style with screen-print texture, retro typography using a creative mix of vintage type styles and lettering. A few decorative elements and small icons related to the topic scattered around the composition. Vary the layout composition for maximum variety. Subtle worn ink imperfections giving a hand-printed vintage feel. Composition is centered, suitable for apparel graphics. Clean isolated graphic design on a solid ${shirtColor} background, NOT a t-shirt mockup, no clothing visible, just the artwork flat on ${shirtColor}.`;
}

async function makeTransparent(inputPath, outputPath, shirtColor) {
  const img = sharp(inputPath);

  const { data, info } = await img
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (
      shirtColor === "black" &&
      r < 25 &&
      g < 25 &&
      b < 25
    ) {
      data[i + 3] = 0;
    }

    if (
      shirtColor === "white" &&
      r > 235 &&
      g > 235 &&
      b > 235
    ) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, {
    raw: info
  })
    .png()
    .toFile(outputPath);
}

export { buildPrompt, makeTransparent };