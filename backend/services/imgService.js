import {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import multer from "multer";
import multerS3 from "multer-s3";
import dotenv from "dotenv";

dotenv.config();

class ImageUploader {
  constructor(
    db,
    config = {
      bucket: "assetkungya",
      region: "ap-northeast-2",
    }
  ) {
    this.db = db; // MongoDB connection
    this.config = config;
    this.s3 = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY || "",
        secretAccessKey: process.env.AWS_SECRETE_ACCESS_KEY || "",
      },
    });
  }

  createThumbnailUploadMiddleware(userId) {
    return multer({
      storage: multerS3({
        s3: this.s3,
        bucket: this.config.bucket,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: async (req, file, cb) => {
          try {
            const timestamp = Date.now();
            const filename = `image/ai_image/${userId}_${timestamp}.png`;
            cb(null, filename);
          } catch (error) {
            cb(error);
          }
        },
        cacheControl: "no-store",
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
          cb(null, true);
        } else {
          cb(new Error("잘못된 파일 유형입니다. 이미지만 허용됩니다."));
        }
      },
    });
  }
}

export default ImageUploader;
