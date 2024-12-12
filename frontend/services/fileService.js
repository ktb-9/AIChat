// fileService.js
import axios, { isCancel, CancelToken } from "axios";
import authService from "./authService";
import { Toast } from "../components/Toast";

class FileService {
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL;
    this.uploadLimit = 50 * 1024 * 1024;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.activeUploads = new Map();

    this.allowedTypes = {
      image: {
        extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
        mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        maxSize: 10 * 1024 * 1024,
        name: "이미지",
      },
      video: {
        extensions: [".mp4", ".webm", ".mov"],
        mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
        maxSize: 50 * 1024 * 1024,
        name: "동영상",
      },
      audio: {
        extensions: [".mp3", ".wav", ".ogg"],
        mimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg"],
        maxSize: 20 * 1024 * 1024,
        name: "오디오",
      },
      document: {
        extensions: [".pdf", ".doc", ".docx", ".txt"],
        mimeTypes: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
        ],
        maxSize: 20 * 1024 * 1024,
        name: "문서",
      },
      archive: {
        extensions: [".zip", ".rar", ".7z"],
        mimeTypes: [
          "application/zip",
          "application/x-rar-compressed",
          "application/x-7z-compressed",
        ],
        maxSize: 50 * 1024 * 1024,
        name: "압축파일",
      },
    };
  }

  async validateFile(file) {
    if (!file) {
      const message = "파일이 선택되지 않았습니다.";
      Toast.error(message);
      return { success: false, message };
    }

    if (file.size > this.uploadLimit) {
      const message = `파일 크기는 ${this.formatFileSize(
        this.uploadLimit
      )}를 초과할 수 없습니다.`;
      Toast.error(message);
      return { success: false, message };
    }

    let isAllowedType = false;
    let maxTypeSize = 0;
    let typeConfig = null;

    for (const config of Object.values(this.allowedTypes)) {
      if (config.mimeTypes.includes(file.type)) {
        isAllowedType = true;
        maxTypeSize = config.maxSize;
        typeConfig = config;
        break;
      }
    }

    if (!isAllowedType) {
      const message = "지원하지 않는 파일 형식입니다.";
      Toast.error(message);
      return { success: false, message };
    }

    if (file.size > maxTypeSize) {
      const message = `${typeConfig.name} 파일은 ${this.formatFileSize(
        maxTypeSize
      )}를 초과할 수 없습니다.`;
      Toast.error(message);
      return { success: false, message };
    }

    const ext = this.getFileExtension(file.name);
    if (!typeConfig.extensions.includes(ext.toLowerCase())) {
      const message = "파일 확장자가 올바르지 않습니다.";
      Toast.error(message);
      return { success: false, message };
    }

    return { success: true };
  }

  async uploadFile(file, onProgress) {
    const validationResult = await this.validateFile(file);
    if (!validationResult.success) {
      return validationResult;
    }

    try {
      const user = authService.getCurrentUser();
      if (!user?.token || !user?.sessionId) {
        return {
          success: false,
          message: "인증 정보가 없습니다.",
        };
      }

      const formData = new FormData();
      formData.append("file", file);

      const source = CancelToken.source();
      this.activeUploads.set(file.name, source);

      const uploadUrl = this.baseUrl
        ? `${this.baseUrl}/api/files/upload`
        : "/api/files/upload";

      const response = await axios.post(uploadUrl, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "x-auth-token": user.token,
          "x-session-id": user.sessionId,
        },
        cancelToken: source.token,
        withCredentials: true,
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        },
      });

      this.activeUploads.delete(file.name);

      if (!response.data || !response.data.success) {
        return {
          success: false,
          message: response.data?.message || "파일 업로드에 실패했습니다.",
        };
      }

      return {
        success: true,
        data: {
          ...response.data,
          file: {
            ...response.data.file,
            // url은 서버에서 받은 것을 그대로 사용
            url: response.data.file.url || response.data.file.location,
          },
        },
      };
    } catch (error) {
      this.activeUploads.delete(file.name);

      if (isCancel(error)) {
        return {
          success: false,
          message: "업로드가 취소되었습니다.",
        };
      }

      if (error.response?.status === 401) {
        try {
          const refreshed = await authService.refreshToken();
          if (refreshed) {
            return this.uploadFile(file, onProgress);
          }
          return {
            success: false,
            message: "인증이 만료되었습니다. 다시 로그인해주세요.",
          };
        } catch (refreshError) {
          return {
            success: false,
            message: "인증이 만료되었습니다. 다시 로그인해주세요.",
          };
        }
      }

      return this.handleUploadError(error);
    }
  }

  getFileExtension(filename) {
    if (!filename) return "";
    const parts = filename.split(".");
    return parts.length > 1 ? `.${parts.pop().toLowerCase()}` : "";
  }

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${units[i]}`;
  }

  handleUploadError(error) {
    console.error("Upload error:", error);

    if (error.code === "ECONNABORTED") {
      return {
        success: false,
        message: "파일 업로드 시간이 초과되었습니다.",
      };
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message;

      switch (status) {
        case 400:
          return {
            success: false,
            message: message || "잘못된 요청입니다.",
          };
        case 401:
          return {
            success: false,
            message: "인증이 필요합니다.",
          };
        case 413:
          return {
            success: false,
            message: "파일이 너무 큽니다.",
          };
        case 415:
          return {
            success: false,
            message: "지원하지 않는 파일 형식입니다.",
          };
        case 500:
          return {
            success: false,
            message: "서버 오류가 발생했습니다.",
          };
        default:
          return {
            success: false,
            message: message || "파일 업로드에 실패했습니다.",
          };
      }
    }

    return {
      success: false,
      message: error.message || "알 수 없는 오류가 발생했습니다.",
      error,
    };
  }

  cancelUpload(filename) {
    const source = this.activeUploads.get(filename);
    if (source) {
      source.cancel("Upload canceled by user");
      this.activeUploads.delete(filename);
      return {
        success: true,
        message: "업로드가 취소되었습니다.",
      };
    }
    return {
      success: false,
      message: "취소할 업로드를 찾을 수 없습니다.",
    };
  }

  cancelAllUploads() {
    let canceledCount = 0;
    for (const [filename, source] of this.activeUploads) {
      source.cancel("All uploads canceled");
      this.activeUploads.delete(filename);
      canceledCount++;
    }

    return {
      success: true,
      message: `${canceledCount}개의 업로드가 취소되었습니다.`,
      canceledCount,
    };
  }
}

export default new FileService();
