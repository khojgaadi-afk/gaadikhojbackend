const multer = require("multer");

// Store file in memory first, then upload to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files are allowed"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
limits: {
  fileSize: 3 * 1024 * 1024, // 3MB
},
});

module.exports = upload;