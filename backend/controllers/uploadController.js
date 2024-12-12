const express = require("express");
const FileUploader = require("../services/imgService"); // Adjust the path as needed

class FileUploadController {
  constructor() {
    this.router = express.Router();
    this.fileUploader = new FileUploader();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Middleware for multer file upload
    const upload = this.fileUploader.upload.single("file");

    // Single file upload route using multer-s3
    this.router.post("/upload", (req, res) => {
      upload(req, res, (err) => {
        if (err) {
          return res.status(500).json({
            error: "File upload failed",
            message: err.message,
          });
        }

        if (!req.file) {
          return res.status(400).json({
            error: "No file uploaded",
          });
        }

        res.status(200).json({
          message: "File uploaded successfully",
          file: {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            location: req.file.location,
            key: req.file.key,
          },
        });
      });
    });

    // Direct buffer upload route
    this.router.post("/upload-buffer", async (req, res) => {
      try {
        // Assuming the file is sent as a buffer in the request body
        const { buffer, originalname, mimetype } = req.body;

        if (!buffer || !originalname || !mimetype) {
          return res.status(400).json({
            error: "Missing file details",
          });
        }

        const uploadResult = await this.fileUploader.uploadFileToS3(
          Buffer.from(buffer, "base64"),
          originalname,
          mimetype
        );

        res.status(200).json({
          message: "File uploaded successfully",
          file: {
            originalname,
            mimetype,
            url: uploadResult.url,
            filename: uploadResult.filename,
          },
        });
      } catch (error) {
        console.error("Buffer upload error:", error);
        res.status(500).json({
          error: "File upload failed",
          message: error.message,
        });
      }
    });

    // File deletion route
    this.router.delete("/delete/:filename", async (req, res) => {
      try {
        const { filename } = req.params;

        if (!filename) {
          return res.status(400).json({
            error: "Filename is required",
          });
        }

        const deleteResult = await this.fileUploader.deleteFile(filename);

        res.status(200).json({
          message: "File deleted successfully",
          result: deleteResult,
        });
      } catch (error) {
        console.error("File deletion error:", error);
        res.status(500).json({
          error: "File deletion failed",
          message: error.message,
        });
      }
    });

    // File existence check route
    this.router.get("/exists/:filename", async (req, res) => {
      try {
        const { filename } = req.params;

        if (!filename) {
          return res.status(400).json({
            error: "Filename is required",
          });
        }

        const exists = await this.fileUploader.checkFileExists(filename);

        res.status(200).json({
          exists,
          filename,
        });
      } catch (error) {
        console.error("File existence check error:", error);
        res.status(500).json({
          error: "Existence check failed",
          message: error.message,
        });
      }
    });
  }

  // Method to get the router for use in the main app
  getRouter() {
    return this.router;
  }
}

module.exports = FileUploadController;
