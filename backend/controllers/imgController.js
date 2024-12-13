// controllers/fileController.js
const { validateSession } = require("../services/sessionService");
const FileUploader = require("../services/imgService");

class FileController {
  constructor() {
    this.fileUploader = new FileUploader();
  }

  async upload(req, res) {
    try {
      const { user } = req;

      // 세션 유효성 검사
      const sessionValidation = await validateSession(user.id, user.sessionId);
      if (!sessionValidation.isValid) {
        return res.status(401).json({
          success: false,
          message: "세션이 만료되었습니다. 다시 로그인해주세요.",
        });
      }

      // multer-s3로 파일 업로드
      this.fileUploader.upload.single("file")(req, res, async (err) => {
        if (err) {
          console.error("File upload error:", err);
          return res.status(400).json({
            success: false,
            message: err.message || "파일 업로드에 실패했습니다.",
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "업로드할 파일이 없습니다.",
          });
        }

        // 업로드 성공 응답
        return res.status(200).json({
          success: true,
          file: {
            filename: req.file.key,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            url: req.file.location,
          },
        });
      });
    } catch (error) {
      console.error("File controller error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "서버 오류가 발생했습니다.",
      });
    }
  }

  async delete(req, res) {
    try {
      const { filename } = req.params;
      const { user } = req;

      // 세션 유효성 검사
      const sessionValidation = await validateSession(user.id, user.sessionId);
      if (!sessionValidation.isValid) {
        return res.status(401).json({
          success: false,
          message: "세션이 만료되었습니다. 다시 로그인해주세요.",
        });
      }

      // 파일 존재 여부 확인
      const exists = await this.fileUploader.checkFileExists(filename);
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: "파일을 찾을 수 없습니다.",
        });
      }

      // 파일 삭제
      await this.fileUploader.deleteFile(filename);

      return res.status(200).json({
        success: true,
        message: "파일이 성공적으로 삭제되었습니다.",
      });
    } catch (error) {
      console.error("File delete error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "서버 오류가 발생했습니다.",
      });
    }
  }
}

module.exports = new FileController();
