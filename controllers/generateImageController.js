import client from "../config/openAiClient.js";
import fs from "fs";
import path from "path";
import sharp from "sharp";

import { PRINT_AREAS } from "../config/printAreas.js";
import { buildPrompt, makeTransparent } from "../utils/imageHandler.js";

const generateImage = async (req, res) => {
  try {
    const {
      prompt,
      color,
      category,
      side,
    } = req.body;

    const enhancedPrompt = buildPrompt(prompt, color);

    const result = await client.images.generate({
      model: "gpt-image-2",
      prompt: enhancedPrompt,
      size: "1024x1536",
    });

    const imageBuffer = Buffer.from(
      result.data[0].b64_json,
      "base64"
    );

    const tempDir = path.join(process.cwd(), "temp");

    fs.mkdirSync(tempDir, {
      recursive: true,
    });

    const designPath = path.join(tempDir, "design.png");
    const transparentPath = path.join(
      tempDir,
      "transparent.png"
    );
    const trimmedPath = path.join(
      tempDir,
      "trimmed.png"
    );
    const resizedPath = path.join(
      tempDir,
      "resized.png"
    );
    const finalPath = path.join(
      tempDir,
      "final.png"
    );

    fs.writeFileSync(designPath, imageBuffer);

    // Remove background
    await makeTransparent(
      designPath,
      transparentPath,
      color
    );

    // Remove transparent padding
    await sharp(transparentPath)
      .trim()
      .png()
      .toFile(trimmedPath);

    const area =
      PRINT_AREAS?.[category]?.[side];

    if (!area) {
      return res.status(400).json({
        success: false,
        message: "Invalid product configuration.",
      });
    }

    const {
      x,
      y,
      width,
      height,
      fit = "inside",
      scale = 0.95,
    } = area;

    // Resize
    await sharp(trimmedPath)
      .resize({
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        fit,
      })
      .png()
      .toFile(resizedPath);

    // Get resized dimensions
    const resizedMeta = await sharp(
      resizedPath
    ).metadata();

    // Center inside printable area
    const left = Math.round(
      x + (width - resizedMeta.width) / 2
    );

    const top = Math.round(
      y + (height - resizedMeta.height) / 2
    );

    const shirtPath = path.join(
      process.cwd(),
      "assets",
      "tshirts",
      `${color}_tshirt_${category}_${side}.png`
    );

    await sharp(shirtPath)
      .composite([
        {
          input: resizedPath,
          left,
          top,
        },
      ])
      .png()
      .toFile(finalPath);

    const finalBase64 = fs.readFileSync(
      finalPath,
      "base64"
    );

    const designBase64 = fs.readFileSync(
      trimmedPath,
      "base64"
    );

    res.status(200).json({
      success: true,
      design: `data:image/png;base64,${designBase64}`,
      mockup: `data:image/png;base64,${finalBase64}`,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export { generateImage };