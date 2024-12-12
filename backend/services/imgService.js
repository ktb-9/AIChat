const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
require("dotenv").config();

class FileUploader {
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

    // multer-s3 설정
    this.upload = multer({
      storage: multerS3({
        s3: this.s3,
        bucket: this.config.bucket,
        key: (req, file, cb) => {
          const fileType = this.getFileType(file.mimetype);
          const timestamp = Date.now();
          cb(null, `${fileType}/${timestamp}_${file.originalname}`);
        },
        contentType: multerS3.AUTO_CONTENT_TYPE,
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
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

  // 직접 S3에 업로드하는 메서드 (multer 없이)
  async uploadFileToS3(fileBuffer, originalname, mimetype) {
    try {
      const timestamp = Date.now();
      const fileType = this.getFileType(mimetype);
      const filename = `${fileType}/${timestamp}_${originalname}`;

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

  // 파일 삭제 메서드
  async deleteFile(filename) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: filename,
      });

      await this.s3.send(command);
      return { success: true };
    } catch (error) {
      console.error("S3 Delete Error:", error);
      throw error;
    }
  }

  // 파일 존재 여부 확인 메서드
  async checkFileExists(filename) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: filename,
      });

      await this.s3.send(command);
      return true;
    } catch (error) {
      if (error.name === "NotFound") {
        return false;
      }
      throw error;
    }
  }
}

module.exports = FileUploader;
