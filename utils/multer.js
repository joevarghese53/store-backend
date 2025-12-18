import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExt = [".jpg", ".jpeg", ".png", ".webp"];
  const allowedMime = ["image/jpeg", "image/png", "image/webp"];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExt.includes(ext) && allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, and WEBP images are allowed"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 15,
  },
});

export const uploadFields = upload.fields([
  { name: "frontImage", maxCount: 1 },
  { name: "backImage", maxCount: 1 },
  { name: "frontDesign", maxCount: 1 },
  { name: "backDesign", maxCount: 1 },
  { name: "frontUpload", maxCount: 1 },
  { name: "backUpload", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);



// ------------------- Checked -------------------------