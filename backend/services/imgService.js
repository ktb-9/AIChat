const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
require("dotenv").config();

class ImageUploader {
  constructor(
    config = {
      bucket: "ktb9-stressed-bucket",
      region: "ap-northeast-2",
    }
  ) {
    this.config = config;
    this.s3 = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY || "",
        secretAccessKey: process.env.AWS_SECRETE_ACCESS_KEY || "",
      },
    });
  }

  async uploadFileToS3(fileBuffer, originalname, mimetype) {
    try {
      const timestamp = Date.now();
      const filename = `image/${timestamp}_${originalname}`;

      const params = {
        Bucket: this.config.bucket,
        Key: filename,
        Body: fileBuffer,
        ContentType: mimetype,
        CacheControl: "no-store",
      };

      const command = new PutObjectCommand(params);
      await this.s3.send(command);

      return {
        url: `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${filename}`,
        filename,
      };
    } catch (error) {
      console.error("S3 Upload Error:", error);
      throw error;
    }
  }
}

module.exports = ImageUploader;
