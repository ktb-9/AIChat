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
  // 클래스 이름도 FileUploader로 변경하는 것이 좋습니다
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

  getFileType(mimetype) {
    if (mimetype.startsWith("image/")) return "image";
    if (mimetype.startsWith("video/")) return "video";
    if (mimetype.startsWith("audio/")) return "audio";
    if (mimetype.startsWith("application/pdf")) return "pdf";
    if (mimetype.startsWith("application/")) return "document";
    return "etc";
  }

  async uploadFileToS3(fileBuffer, originalname, mimetype) {
    try {
      const timestamp = Date.now();
      const fileType = this.getFileType(mimetype);
      const filename = `${fileType}/${timestamp}_${originalname}`; // 파일 타입별 경로

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
