import client from "../config/openAiClient.js";
import fs from "fs";
import path from "path";
import sharp from "sharp";

import { PRINT_AREAS } from "../config/printAreas.js";
import {
  buildPrompt,
  makeTransparent,
} from "../utils/imageHandler.js";

const generateImage = async (req, res) => {
  try {
    const {
      prompt,
      color,
      category,
      side,
    } = req.body;

    // -----------------------------------------
    // 1. BUILD AI PROMPT
    // -----------------------------------------

    const enhancedPrompt = buildPrompt(
      prompt,
      color
    );

    // -----------------------------------------
    // 2. GENERATE DESIGN
    // -----------------------------------------

    const result = await client.images.generate({
      model: "gpt-image-2",
      prompt: enhancedPrompt,
      size: "1024x1536",
    });

    if (
      !result?.data?.[0]?.b64_json
    ) {
      throw new Error(
        "Image generation failed."
      );
    }

    const imageBuffer = Buffer.from(
      result.data[0].b64_json,
      "base64"
    );

    // -----------------------------------------
    // 3. TEMP DIRECTORY
    // -----------------------------------------

    const tempDir = path.join(
      process.cwd(),
      "temp"
    );

    fs.mkdirSync(tempDir, {
      recursive: true,
    });

    const designPath = path.join(
      tempDir,
      "design.png"
    );

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

    // -----------------------------------------
    // 4. SAVE ORIGINAL DESIGN
    // -----------------------------------------

    fs.writeFileSync(
      designPath,
      imageBuffer
    );

    // -----------------------------------------
    // 5. REMOVE BACKGROUND
    // -----------------------------------------

    await makeTransparent(
      designPath,
      transparentPath,
      color
    );

    // -----------------------------------------
    // 6. TRIM TRANSPARENT PADDING
    // -----------------------------------------

    await sharp(transparentPath)
      .trim()
      .png()
      .toFile(trimmedPath);

    // -----------------------------------------
    // 7. GET PRINT AREA
    // -----------------------------------------

    const area =
      PRINT_AREAS?.[category]?.[side];

    if (!area) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid product configuration.",
      });
    }

    const {
      x,
      y,
      width,
      height,
      scale = 0.95,
    } = area;

    // -----------------------------------------
    // 8. VALIDATE PRINT AREA
    // -----------------------------------------

    if (
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid print area dimensions.",
      });
    }

    // -----------------------------------------
    // 9. RESIZE DESIGN
    // -----------------------------------------

    const targetWidth = Math.round(
      width * scale
    );

    const targetHeight = Math.round(
      height * scale
    );

    await sharp(trimmedPath)
      .resize({
        width: targetWidth,
        height: targetHeight,

        // IMPORTANT:
        // Preserve original aspect ratio.
        fit: "inside",

        // Allow the design to enlarge.
        withoutEnlargement: false,
      })
      .png()
      .toFile(resizedPath);

    // -----------------------------------------
    // 10. GET ACTUAL RESIZED DIMENSIONS
    // -----------------------------------------

    const resizedMeta =
      await sharp(resizedPath).metadata();

    const resizedWidth =
      resizedMeta.width;

    const resizedHeight =
      resizedMeta.height;

    if (
      !resizedWidth ||
      !resizedHeight
    ) {
      throw new Error(
        "Unable to determine resized design dimensions."
      );
    }

    // -----------------------------------------
    // 11. CENTER DESIGN IN PRINT AREA
    // -----------------------------------------

    const left = Math.round(
      x +
        (width - resizedWidth) / 2
    );

    const top = Math.round(
      y +
        (height - resizedHeight) / 2
    );

    // -----------------------------------------
    // 12. SHIRT PATH
    // -----------------------------------------

    const shirtPath = path.join(
      process.cwd(),
      "assets",
      "tshirts",
      "regular",
      `${color}_tshirt_${category}_${side}.png`
    );

    // -----------------------------------------
    // 13. CHECK SHIRT EXISTS
    // -----------------------------------------

    if (!fs.existsSync(shirtPath)) {
      return res.status(404).json({
        success: false,
        message:
          `T-shirt image not found: ${shirtPath}`,
      });
    }

    // -----------------------------------------
    // 14. GET SHIRT DIMENSIONS
    // -----------------------------------------

    const shirtMeta =
      await sharp(shirtPath).metadata();

    const shirtWidth =
      shirtMeta.width;

    const shirtHeight =
      shirtMeta.height;

    if (
      !shirtWidth ||
      !shirtHeight
    ) {
      throw new Error(
        "Unable to determine T-shirt dimensions."
      );
    }

    // -----------------------------------------
    // 15. MAKE SURE DESIGN IS INSIDE SHIRT
    // -----------------------------------------

    if (
      left < 0 ||
      top < 0 ||
      left + resizedWidth >
        shirtWidth ||
      top + resizedHeight >
        shirtHeight
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Print area extends outside the T-shirt canvas.",
      });
    }

    // -----------------------------------------
    // 16. DEBUG LOG
    // -----------------------------------------

    console.log(
      "\n========== MOCKUP DEBUG =========="
    );

    console.log("Category:", category);
    console.log("Side:", side);
    console.log("Color:", color);

    console.log("Shirt:", {
      width: shirtWidth,
      height: shirtHeight,
    });

    console.log("Print Area:", {
      x,
      y,
      width,
      height,
      scale,
    });

    console.log("Design:", {
      original: "1024x1536",
      trimmed: await getImageDimensions(
        trimmedPath
      ),
      resized: {
        width: resizedWidth,
        height: resizedHeight,
      },
    });

    console.log("Final Position:", {
      left,
      top,
    });

    console.log(
      "==================================\n"
    );

    // -----------------------------------------
    // 17. COMPOSITE DESIGN ON SHIRT
    // -----------------------------------------

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

    // -----------------------------------------
    // 18. READ FINAL FILES
    // -----------------------------------------

    const finalBase64 =
      fs.readFileSync(
        finalPath,
        "base64"
      );

    const designBase64 =
      fs.readFileSync(
        trimmedPath,
        "base64"
      );

    // -----------------------------------------
    // 19. RESPONSE
    // -----------------------------------------

    return res.status(200).json({
      success: true,

      design:
        `data:image/png;base64,${designBase64}`,

      mockup:
        `data:image/png;base64,${finalBase64}`,
    });

  } catch (error) {
    console.error(
      "Generate image error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to generate image.",
    });
  }
};


// -----------------------------------------
// HELPER
// -----------------------------------------

const getImageDimensions = async (
  imagePath
) => {
  const meta =
    await sharp(imagePath).metadata();

  return {
    width: meta.width,
    height: meta.height,
  };
};


export {
  generateImage,
};