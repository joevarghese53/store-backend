export const uploadImages = async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ message: "No image files provided" });
  }

  const allowedFields = [
    "frontImage",
    "backImage",
    "frontDesign",
    "backDesign",
    "frontUpload",
    "backUpload",
    "images",
  ];

  try {
    const uploadedImages = {};

    for (const [field, files] of Object.entries(req.files)) {
      if (!allowedFields.includes(field)) {
        return res.status(400).json({ message: `Invalid field: ${field}` });
      }

      uploadedImages[field] = [];

      for (const file of files) {
        const { uploadToR2 } = await import("../services/r2Service.js");
        const url = await uploadToR2(file);
        uploadedImages[field].push(url);
      }
    }

    return res.status(200).json({
      message: "Images uploaded successfully",
      imageUrls: uploadedImages,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      message: "Image upload failed",
      error: error.message,
    });
  }
};

// ------------------- Checked -------------------------