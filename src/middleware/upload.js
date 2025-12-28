// middlewares/upload.js
import multer  from "multer";

const storage = multer.memoryStorage(); 

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error("Only CSV or Excel files allowed"), false);
    }
    cb(null, true);
  },
});

export { upload};
