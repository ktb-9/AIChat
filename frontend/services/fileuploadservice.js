import axios from "axios";

class FileUploadService {
  constructor() {
    this.uploadInstance = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL, // Your API base URL
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }

  /**
   * Upload a single file to the server
   * @param {File} file - The file to upload
   * @param {Function} onUploadProgress - Callback function to track upload progress
   * @returns {Promise<Object>} Upload response
   */
  async uploadFile(file, onUploadProgress = null) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await this.uploadInstance.post(
        "/api/aws/upload",
        formData,
        {
          onUploadProgress: (progressEvent) => {
            if (onUploadProgress) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              onUploadProgress(percentCompleted);
            }
          },
        }
      );
      console.log("서버", response.data);

      // Assuming the API returns an object with file details
      return {
        success: true,
        data: {
          file: {
            location: response.data.file.location,
            originalname: file.name,
            mimetype: file.type,
            size: file.size,
          },
        },
      };
    } catch (error) {
      console.error("File upload error:", error);

      // Normalize error response
      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          "파일 업로드에 실패했습니다.",
      };
    }
  }

  /**
   * Upload multiple files
   * @param {File[]} files - Array of files to upload
   * @param {Function} onUploadProgress - Callback function to track overall progress
   * @returns {Promise<Object[]>} Array of upload responses
   */
  async uploadMultipleFiles(files, onUploadProgress = null) {
    try {
      const uploadPromises = files.map((file, index) =>
        this.uploadFile(file, (progress) => {
          // Distribute progress across multiple files
          if (onUploadProgress) {
            const individualProgress = progress / files.length;
            onUploadProgress(Math.round(individualProgress * (index + 1)));
          }
        })
      );

      const uploadResults = await Promise.all(uploadPromises);
      return uploadResults;
    } catch (error) {
      console.error("Multiple file upload error:", error);
      throw error;
    }
  }

  /**
   * Delete a file by its URL or filename
   * @param {string} fileIdentifier - URL or filename to delete
   * @returns {Promise<Object>} Deletion response
   */
  async deleteFile(fileIdentifier) {
    try {
      const response = await this.uploadInstance.delete("/files/delete", {
        params: { url: fileIdentifier },
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error("File deletion error:", error);
      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          "파일 삭제에 실패했습니다.",
      };
    }
  }
}

export default new FileUploadService();
