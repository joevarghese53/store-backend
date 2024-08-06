import express from "express";
import multer from "multer";
import { Storage } from "@google-cloud/storage";
import path from "path";

const router = express.Router();

// Initialize Google Cloud Storage
const storage = new Storage();
const bucketName = "tshirt-uploads";
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
const uploadSingleImage = upload.single("image");

router.post("/", (req, res) => {
  uploadSingleImage(req, res, async (err) => {
    if (err) {
      return res.status(400).send({ message: err.message });
    } else if (!req.file) {
      return res.status(400).send({ message: "No image file provided" });
    }

    try {
      const blob = bucket.file(`${Date.now()}_${req.file.originalname}`);
      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: req.file.mimetype,
      });

      blobStream.on("error", (error) => {
        res.status(500).send({ message: error.message });
      });

      blobStream.on("finish", () => {
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
        res.status(200).send({
          message: "Image uploaded successfully",
          image: publicUrl,
        });
      });

      blobStream.end(req.file.buffer);
    } catch (error) {
      res.status(500).send({ message: error.message });
    }
  });
});

export default router;
