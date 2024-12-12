import React, { useState } from "react";
import { Button } from "@goorm-dev/vapor-core";
import {
  FileText,
  Image,
  Film,
  Music,
  ExternalLink,
  Download,
  AlertCircle,
} from "lucide-react";
import { Text, Alert } from "@goorm-dev/vapor-components";
import PersistentAvatar from "../../common/PersistentAvatar";
import MessageContent from "./MessageContent";
import MessageActions from "./MessageActions";
import ReadStatus from "../ReadStatus";

const FileMessage = ({
  msg = {},
  isMine = false,
  currentUser = null,
  onReactionAdd,
  onReactionRemove,
  room = null,
  messageRef,
  socketRef,
}) => {
  const [error, setError] = useState(null);

  if (!msg?.metadata?.fileUrls?.length) {
    console.error("File URL is missing:", msg);
    return null;
  }

  const formattedTime = new Date(msg.timestamp)
    .toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(/\./g, "년")
    .replace(/\s/g, " ")
    .replace("일 ", "일 ");

  const getFileType = (url) => {
    const extension = url.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif"].includes(extension)) return "image";
    if (["mp4", "webm", "ogg"].includes(extension)) return "video";
    if (["mp3", "wav"].includes(extension)) return "audio";
    return "file";
  };

  const getFileIcon = (type) => {
    const iconProps = { className: "w-5 h-5 flex-shrink-0" };
    switch (type) {
      case "image":
        return <Image {...iconProps} color="#00C853" />;
      case "video":
        return <Film {...iconProps} color="#2196F3" />;
      case "audio":
        return <Music {...iconProps} color="#9C27B0" />;
      default:
        return <FileText {...iconProps} color="#ffffff" />;
    }
  };

  const renderAvatar = () => (
    <PersistentAvatar
      user={isMine ? currentUser : msg.sender}
      size="lg"
      className="flex-shrink-0"
      showInitials={true}
    />
  );

  const handleFileDownload = async (url, e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = decodeURIComponent(url.split("/").pop());
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("File download error:", error);
      setError("파일 다운로드 중 오류가 발생했습니다.");
    }
  };

  const handleViewInNewTab = (url, e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const newWindow = window.open(url, "_blank");
      if (!newWindow) {
        throw new Error("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
      }
      newWindow.opener = null;
    } catch (error) {
      console.error("File view error:", error);
      setError("파일 보기 중 오류가 발생했습니다.");
    }
  };

  const renderPreview = (url, type) => {
    switch (type) {
      case "image":
        return (
          <div className="bg-transparent-pattern">
            <img
              src={url}
              alt="이미지"
              className="object-cover rounded-sm"
              onLoad={() => console.debug("Image loaded successfully")}
              onError={(e) => {
                console.error("Image load error");
                e.target.onerror = null;
                e.target.src = "/images/placeholder-image.png";
                setError("이미지를 불러올 수 없습니다.");
              }}
              loading="lazy"
            />
          </div>
        );

      case "video":
        return (
          <video
            className="object-cover rounded-sm w-full"
            controls
            preload="metadata"
            aria-label="비디오"
            crossOrigin="use-credentials"
          >
            <source src={url} />
            <track kind="captions" />
            비디오를 재생할 수 없습니다.
          </video>
        );

      case "audio":
        return (
          <audio
            className="w-full"
            controls
            preload="metadata"
            aria-label="오디오"
            crossOrigin="use-credentials"
          >
            <source src={url} />
            오디오를 재생할 수 없습니다.
          </audio>
        );

      default:
        return null;
    }
  };

  const renderFilePreview = () => {
    const fileUrl = msg.metadata.fileUrls[0];
    const fileName = decodeURIComponent(fileUrl.split("/").pop());
    const fileType = getFileType(fileUrl);

    const FileActions = () => (
      <div className="file-actions mt-2 pt-2 border-t border-gray-200">
        <Button
          onClick={(e) => handleViewInNewTab(fileUrl, e)}
          className="file-action-button hover:bg-gray-100"
          title="새 탭에서 보기"
        >
          <ExternalLink size={16} />
          <span>새 탭에서 보기</span>
        </Button>
        <Button
          onClick={(e) => handleFileDownload(fileUrl, e)}
          className="file-action-button hover:bg-gray-100"
          title="다운로드"
        >
          <Download size={16} />
          <span>다운로드</span>
        </Button>
      </div>
    );

    const previewWrapperClass = "overflow-hidden mb-4 last:mb-0";
    const fileInfoClass = "flex items-center gap-3 p-1 mt-2";

    return (
      <div className={previewWrapperClass}>
        {renderPreview(fileUrl, fileType)}
        <div className={fileInfoClass}>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">
              {getFileIcon(fileType)} {fileName}
            </div>
          </div>
        </div>
        <FileActions />
      </div>
    );
  };

  return (
    <div className="messages">
      <div className={`message-group ${isMine ? "mine" : "yours"}`}>
        <div className="message-sender-info">
          {renderAvatar()}
          <span className="sender-name">
            {isMine ? "나" : msg.sender?.name}
          </span>
        </div>
        <div
          className={`message-bubble ${
            isMine ? "message-mine" : "message-other"
          } last file-message`}
        >
          <div className="message-content">
            {error && (
              <Alert
                color="danger"
                className="mb-3"
                onClose={() => setError(null)}
              >
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </Alert>
            )}
            {renderFilePreview()}
            {msg.content && (
              <div className="mt-3">
                <MessageContent content={msg.content} />
              </div>
            )}
          </div>
          <div className="message-footer">
            <div className="message-time mr-3">{formattedTime}</div>
            <ReadStatus
              messageType={msg.type}
              participants={room.participants}
              readers={msg.readers}
              messageId={msg._id}
              messageRef={messageRef}
              currentUserId={currentUser.id}
              socketRef={socketRef}
            />
          </div>
        </div>
        <MessageActions
          messageId={msg._id}
          messageContent={msg.content}
          reactions={msg.reactions}
          currentUserId={currentUser?.id}
          onReactionAdd={onReactionAdd}
          onReactionRemove={onReactionRemove}
          isMine={isMine}
          room={room}
        />
      </div>
    </div>
  );
};

FileMessage.defaultProps = {
  msg: {},
  isMine: false,
  currentUser: null,
};

export default React.memo(FileMessage);
