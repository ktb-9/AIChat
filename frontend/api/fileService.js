import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

class FileService {
  constructor() {
    this.s3Client = new S3Client({
      region: "ap-northeast-2",
      credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async uploadToS3(file) {
    try {
      const timestamp = Date.now();
      const fileName = `image/${timestamp}_${file.name}`;

      const uploadParams = {
        Bucket: "assetkungya",
        Key: fileName,
        Body: file,
        ContentType: file.type,
      };

      const upload = new Upload({
        client: this.s3Client,
        params: uploadParams,
      });

      // 업로드 진행 상황 모니터링 (선택사항)
      upload.on("httpUploadProgress", (progress) => {
        const percentage = Math.round((progress.loaded / progress.total) * 100);
        console.log(`Upload progress: ${percentage}%`);
      });

      // S3에 업로드
      const result = await upload.done();

      // S3 URL 생성
      const fileUrl = `https://ktb9-stressed-bucket.s3.ap-northeast-2.amazonaws.com/${fileName}`;

      return {
        success: true,
        data: {
          url: fileUrl,
          filename: fileName,
        },
      };
    } catch (error) {
      console.error("S3 Upload Error:", error);
      return {
        success: false,
        message: error.message || "파일 업로드 중 오류가 발생했습니다.",
      };
    }
  }
}
export default new FileService();
