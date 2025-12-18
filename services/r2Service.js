import crypto from "crypto";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.CLOUDFLARE_BUCKET_NAME;
const PUBLIC_URL = process.env.CLOUDFLARE_PUBLIC_URL;

const generateFileName = (originalName) =>
  `${crypto.randomUUID()}${path.extname(originalName)}`;

export const uploadToR2 = async (file) => {
  const key = generateFileName(file.originalname);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${PUBLIC_URL}/${key}`;
};



// ------------------- Checked -------------------------