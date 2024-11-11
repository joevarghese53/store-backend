import express from "express";
import multer from "multer";
import { Storage } from "@google-cloud/storage";
import path from "path";

const router = express.Router();

// Initialize Google Cloud Storage
const storage = new Storage();
const bucketName = "tshirt-upload";
const bucket = storage.bucket(bucketName);

const multerStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const filetypes = /jpe?g|png|webp/;
  const mimetypes = /image\/jpe?g|image\/png|image\/webp/;

  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  if (filetypes.test(extname) && mimetypes.test(mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Images only"), false);
  }
};

const upload = multer({ storage: multerStorage, fileFilter });
const uploadFields = upload.fields([
  { name: "frontImage", maxCount: 1 },
  { name: "backImage", maxCount: 1 },
  { name: "frontDesign", maxCount: 1 },
  { name: "backDesign", maxCount: 1 },
  { name: "frontUpload", maxCount: 1 },
  { name: "backUpload", maxCount: 1 },
  { name: "images", maxCount: 10 } // For array of additional images
]);

router.post("/", (req, res) => {
  uploadFields(req, res, async (err) => {
    if (err) {
      return res.status(400).send({ message: err.message });
    } else if (!req.files) {
      return res.status(400).send({ message: "No image files provided" });
    }

    try {
      const imageUrls = {};

      // Loop through each field in req.files
      for (const [fieldName, fileArray] of Object.entries(req.files)) {
        imageUrls[fieldName] = [];

        // Process each file in the array
        for (const file of fileArray) {
          const blob = bucket.file(`${Date.now()}_${file.originalname}`);
          const blobStream = blob.createWriteStream({
            resumable: false,
            contentType: file.mimetype,
          });

          await new Promise((resolve, reject) => {
            blobStream.on("error", (error) => reject(error));
            blobStream.on("finish", () => {
              const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
              imageUrls[fieldName].push(publicUrl); // Push URL to array for this field
              resolve();
            });

            blobStream.end(file.buffer);
          });
        }
      }

      console.log(imageUrls);

      res.status(200).send({
        message: "Images uploaded successfully",
        imageUrls,
      });
    } catch (error) {
      res.status(500).send({ message: error.message });
    }
  });
});

export default router;

