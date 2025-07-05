import express from "express";
import multer from "multer";
import AWS from "aws-sdk";
import path from "path";
import dotenv from "dotenv";


const router = express.Router();
dotenv.config(); 

// ✅ Cloudflare R2 Config (S3-compatible)
const s3 = new AWS.S3({
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT, 
  accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
  secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  region: "auto",
  signatureVersion: "v4",
});

console.log("R2 Endpoint:", process.env.CLOUDFLARE_R2_ENDPOINT);
console.log("R2 Access Key ID:", process.env.CLOUDFLARE_ACCESS_KEY_ID);
console.log("R2 Secret Access Key:", process.env.CLOUDFLARE_SECRET_ACCESS_KEY);
console.log("R2 Bucket Name:", process.env.CLOUDFLARE_BUCKET_NAME);

const BUCKET_NAME = process.env.CLOUDFLARE_BUCKET_NAME;

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
  { name: "images", maxCount: 10 },
]);

router.post("/", (req, res) => {
  uploadFields(req, res, async (err) => {
    if (err) return res.status(400).send({ message: err.message });
    if (!req.files) return res.status(400).send({ message: "No image files provided" });

    try {
      const imageUrls = {};

      for (const [fieldName, fileArray] of Object.entries(req.files)) {
        imageUrls[fieldName] = [];

        for (const file of fileArray) {
          const fileName = `${Date.now()}_${file.originalname}`;

          await s3
            .upload({
              Bucket: BUCKET_NAME,
              Key: fileName,
              Body: file.buffer,
              ContentType: file.mimetype,
              ACL: "public-read", // Make publicly accessible
            })
            .promise();

          const publicUrl = `${process.env.CLOUDFLARE_PUBLIC_URL}/${fileName}`;
          imageUrls[fieldName].push(publicUrl);
        }
      }

      console.log(imageUrls);

      res.status(200).send({
        message: "Images uploaded to R2 successfully",
        imageUrls,
      });
    } catch (error) {
      console.error("R2 upload error:", error);
      res.status(500).send({ message: error.message });
    }
  });
});

export default router;
