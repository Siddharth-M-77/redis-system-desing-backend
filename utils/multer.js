// utils/bannerUpload.js
import multer from "multer";
import path from "path";

// Destination and filename config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/banners"); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const bannerUpload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

export default bannerUpload;
