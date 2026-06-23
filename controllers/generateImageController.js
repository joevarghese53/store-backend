import client from "../config/openAiClient.js";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { buildPrompt, makeTransparent } from "../utils/imageHandler.js";

const generateImage = async (req, res) => {
  try {
    const {
      prompt,
      color,
      coords,
      category,
      side,
      device,
    } = req.body;

    console.log("Received request with body:", req.body);
    const enhancedPrompt = buildPrompt(
      prompt,
      color
    );

    const result = await client.images.generate({
      model: "gpt-image-2",
      prompt: enhancedPrompt,
      size: "1024x1536"
    });

    const imageBuffer = Buffer.from(
      result.data[0].b64_json,
      "base64"
    );

    const designPath = path.join(
      process.cwd(),
      "temp",
      "design.png"
    );

    const transparentPath = path.join(
      process.cwd(),
      "temp",
      "transparent.png"
    );

    const resizedPath = path.join(
      process.cwd(),
      "temp",
      "resized.png"
    );

    const finalPath = path.join(
      process.cwd(),
      "temp",
      "final.png"
    );

    fs.mkdirSync(
      path.join(process.cwd(), "temp"),
      { recursive: true }
    );

    fs.writeFileSync(designPath, imageBuffer);

    await makeTransparent(
      designPath,
      transparentPath,
      color
    );

    const printWidth = coords[2] - coords[0];
    const printHeight = coords[3] - coords[1];

    await sharp(transparentPath)
      .resize({
        width: Math.round(printWidth),
        height: Math.round(printHeight),
        fit: "inside"
      })
      .png()
      .toFile(resizedPath);

    const resizedMeta = await sharp(resizedPath).metadata();

    const shirtPath = path.join(
      process.cwd(),
      "assets/tshirts",
      `${color}_tshirt_${category}_${side}_${device}.png`
    );

    const x =
      coords[0] +
      (printWidth - resizedMeta.width) / 2;

    const y =
      coords[1] +
      (printHeight - resizedMeta.height) / 2;

    await sharp(shirtPath)
      .composite([
        {
          input: resizedPath,
          left: Math.round(x),
          top: Math.round(y)
        }
      ])
      .png()
      .toFile(finalPath);

    const finalBase64 = fs.readFileSync(finalPath, {
      encoding: "base64"
    });

    const designBase64 = fs.readFileSync(
      transparentPath,
      {
        encoding: "base64"
      }
    );
    console.log("Final image generated successfully.");
    res.status(200).json({
      success: true,
      design:
        `data:image/png;base64,${designBase64}`,
      mockup:
        `data:image/png;base64,${finalBase64}`
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export {
  generateImage
};