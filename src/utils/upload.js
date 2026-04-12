const multer = require("multer");
const cloudinary = require("../config/cloudinary");

// memory storage (NO LOCAL FILE SAVE)
const storage = multer.memoryStorage();

// file filter
const fileFilter = (req, file, cb) => {
  const allowed = /jpg|jpeg|png|pdf/;
  const isValid =
    allowed.test(file.mimetype) ||
    allowed.test(file.originalname.toLowerCase());

  if (!isValid) {
    return cb(new Error("Only images & pdf allowed"), false);
  }

  cb(null, true);
};

const upload = multer({ storage, fileFilter });

// Upload helper (🔥 main magic)
const uploadToCloudinary = (fileBuffer, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "auto", // image + pdf support
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      )
      .end(fileBuffer);
  });
};

module.exports = {
  upload,
  uploadToCloudinary,
};