import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Spinner, Text } from "@goorm-dev/vapor-components";
import { SystemMessage, FileMessage, UserMessage, AIMessage } from "./Message";

class ScrollHandler {
  constructor(containerRef) {
    this.containerRef = containerRef;
    this.scrollHeightBeforeLoadRef = { current: 0 };
    this.scrollTopBeforeLoadRef = { current: 0 };
    this.isLoadingOldMessages = { current: false };
    this.isRestoringScroll = { current: false };
    this.isNearBottom = { current: true };
    this.scrollTimeoutRef = { current: null };
    this.scrollRestorationRef = { current: null };
    this.temporaryDisableScroll = { current: false };
    this.scrollBehavior = { current: "smooth" };
    this.isLoadingRef = { current: false };
    this.loadMoreTriggeredRef = { current: false };

    this.SCROLL_THRESHOLD = 30;
    this.SCROLL_DEBOUNCE_DELAY = 100;
    this.lastFrameTime = 0;
    this.scrollQueue = [];
    this.messageCache = new Map();
  }

  processScrollQueue() {
    if (this.scrollQueue.length === 0) return;

    const currentTime = performance.now();
    if (currentTime - this.lastFrameTime < 16) {
      // ~60fps
      requestAnimationFrame(() => this.processScrollQueue());
      return;
    }

    const task = this.scrollQueue.shift();
    task();
    this.lastFrameTime = currentTime;

    if (this.scrollQueue.length > 0) {
      requestAnimationFrame(() => this.processScrollQueue());
    }
  }

  queueScrollTask(task) {
    this.scrollQueue.push(task);
    this.processScrollQueue();
  }

  logDebug(action, data) {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[ScrollHandler] ${action}:`, {
        ...data,
        timestamp: new Date().toISOString(),
      });
    }
  }

  saveScrollPosition() {
    const container = this.containerRef.current;
    if (!container) return;

    this.scrollHeightBeforeLoadRef.current = container.scrollHeight;
    this.scrollTopBeforeLoadRef.current = container.scrollTop;
    this.isLoadingOldMessages.current = true;

    this.messageCache.set("scrollState", {
      height: container.scrollHeight,
      top: container.scrollTop,
      timestamp: Date.now(),
    });

    this.logDebug("saveScrollPosition", {
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
    });
  }

  async startLoadingMessages() {
    if (this.isLoadingRef.current || this.loadMoreTriggeredRef.current) {
      this.logDebug("startLoadingMessages prevented", {
        isLoading: this.isLoadingRef.current,
        loadMoreTriggered: this.loadMoreTriggeredRef.current,
      });
      return false;
    }

    this.saveScrollPosition();
    this.isLoadingRef.current = true;
    this.loadMoreTriggeredRef.current = true;
    return true;
  }

  restoreScrollPosition(immediate = true) {
    const container = this.containerRef.current;
    if (!container || !this.isLoadingOldMessages.current) return;

    this.queueScrollTask(() => {
      try {
        this.isRestoringScroll.current = true;
        this.temporaryDisableScroll.current = true;

        const newScrollHeight = container.scrollHeight;
        const heightDifference =
          newScrollHeight - this.scrollHeightBeforeLoadRef.current;
        const newScrollTop =
          this.scrollTopBeforeLoadRef.current + heightDifference;

        if (immediate) {
          const originalScrollBehavior = container.style.scrollBehavior;
          container.style.scrollBehavior = "auto";
          container.scrollTop = newScrollTop;

          requestAnimationFrame(() => {
            container.style.scrollBehavior = originalScrollBehavior;
            this.temporaryDisableScroll.current = false;
            this.isRestoringScroll.current = false;
          });
        } else {
          container.scrollTo({
            top: newScrollTop,
            behavior: "smooth",
          });
          this.temporaryDisableScroll.current = false;
          this.isRestoringScroll.current = false;
        }
      } finally {
        this.resetScrollState();
      }
    });
  }

  resetScrollState() {
    this.scrollHeightBeforeLoadRef.current = 0;
    this.scrollTopBeforeLoadRef.current = 0;
    this.isLoadingOldMessages.current = false;
    this.isLoadingRef.current = false;
    this.loadMoreTriggeredRef.current = false;
    this.messageCache.delete("scrollState");

    requestAnimationFrame(() => {
      this.isRestoringScroll.current = false;
      this.temporaryDisableScroll.current = false;
    });
  }

  shouldScrollToBottom(newMessage, isMine) {
    if (this.isLoadingOldMessages.current || this.isRestoringScroll.current) {
      return false;
    }
    return isMine || this.isNearBottom.current;
  }

  updateScrollPosition() {
    const container = this.containerRef.current;
    if (!container) return null;

    const { scrollTop, scrollHeight, clientHeight } = container;
    this.isNearBottom.current = scrollHeight - scrollTop - clientHeight < 100;

    const scrollInfo = {
      isAtTop: scrollTop < this.SCROLL_THRESHOLD,
      isAtBottom: this.isNearBottom.current,
      scrollTop,
      scrollHeight,
      clientHeight,
    };

    this.logDebug("updateScrollPosition", scrollInfo);
    return scrollInfo;
  }

  async handleScroll(event, options) {
    const {
      hasMoreMessages,
      loadingMessages,
      onLoadMore,
      onScrollPositionChange,
      onScroll,
    } = options;

    if (this.temporaryDisableScroll.current || this.isRestoringScroll.current) {
      this.logDebug("handleScroll skipped", {
        temporaryDisableScroll: this.temporaryDisableScroll.current,
        isRestoringScroll: this.isRestoringScroll.current,
      });
      return;
    }

    const scrollInfo = this.updateScrollPosition();
    if (!scrollInfo) return;

    if (this.scrollTimeoutRef.current) {
      clearTimeout(this.scrollTimeoutRef.current);
    }

    this.scrollTimeoutRef.current = setTimeout(async () => {
      if (scrollInfo.isAtTop && hasMoreMessages && !loadingMessages) {
        if (await this.startLoadingMessages()) {
          try {
            await onLoadMore();
          } catch (error) {
            console.error("Load more error:", error);
            this.resetScrollState();
          }
        }
      }

      Promise.resolve().then(() => {
        onScrollPositionChange?.(scrollInfo);
        onScroll?.(scrollInfo);
      });
    }, this.SCROLL_DEBOUNCE_DELAY);
  }

  scrollToBottom(behavior = "smooth") {
    if (this.isLoadingOldMessages.current || this.isRestoringScroll.current) {
      return;
    }

    const container = this.containerRef.current;
    if (!container) return;

    this.queueScrollTask(() => {
      try {
        const scrollHeight = container.scrollHeight;
        const height = container.clientHeight;
        const maxScrollTop = scrollHeight - height;

        container.scrollTo({
          top: maxScrollTop,
          behavior,
        });

        this.logDebug("scrollToBottom", {
          scrollHeight,
          height,
          maxScrollTop,
          behavior,
        });
      } catch (error) {
        console.error("Scroll to bottom error:", error);
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  cleanup() {
    if (this.scrollTimeoutRef.current) {
      clearTimeout(this.scrollTimeoutRef.current);
    }
    if (this.scrollRestorationRef.current) {
      cancelAnimationFrame(this.scrollRestorationRef.current);
    }
    this.scrollQueue = [];
    this.messageCache.clear();
  }
}

const LoadingIndicator = React.memo(({ text }) => (
  <div className="loading-messages">
    <Spinner size="sm" className="text-primary" />
    <Text size="sm" color="secondary">
      {text}
    </Text>
  </div>
));
LoadingIndicator.displayName = "LoadingIndicator";

const MessageHistoryEnd = React.memo(() => (
  <div className="message-history-end">
    <Text size="sm" color="secondary">
      더 이상 불러올 메시지가 없습니다.
    </Text>
  </div>
));
MessageHistoryEnd.displayName = "MessageHistoryEnd";

const EmptyMessages = React.memo(() => (
  <div className="empty-messages">
    <p>아직 메시지가 없습니다.</p>
    <p>첫 메시지를 보내보세요!</p>
  </div>
));
EmptyMessages.displayName = "EmptyMessages";

const ChatMessages = ({
  messages = [],
  streamingMessages = {},
  currentUser = null,
  room = null,
  loadingMessages = false,
  hasMoreMessages = true,
  onScroll = () => {},
  onLoadMore = () => {},
  onReactionAdd = () => {},
  onReactionRemove = () => {},
  messagesEndRef,
  socketRef,
  scrollToBottomOnNewMessage = true,
  onScrollPositionChange = () => {},
}) => {
  const containerRef = useRef(null);
  const lastMessageRef = useRef(null);
  const initialScrollRef = useRef(false);
  const lastMessageCountRef = useRef(messages.length);
  const initialLoadRef = useRef(true);
  const loadingTimeoutRef = useRef(null);
  const scrollHandler = useRef(new ScrollHandler(containerRef));
  const messageCache = useRef(new Map());

  const logDebug = useCallback(
    (action, data) => {
      if (process.env.NODE_ENV === "development") {
        console.debug(`[ChatMessages] ${action}:`, {
          ...data,
          loadingMessages,
          hasMoreMessages,
          isLoadingOldMessages:
            scrollHandler.current.isLoadingOldMessages.current,
          messageCount: messages.length,
          timestamp: new Date().toISOString(),
          isInitialLoad: initialLoadRef.current,
        });
      }
    },
    [loadingMessages, hasMoreMessages, messages.length]
  );
  // allMessages를 먼저 정의
  const allMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];

    const streamingArray = Object.values(streamingMessages || {});
    return [...messages, ...streamingArray].sort((a, b) => {
      if (!a?.timestamp || !b?.timestamp) return 0;
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
  }, [messages, streamingMessages]);

  const isMine = useCallback(
    (msg) => {
      if (!msg?.sender || !currentUser?.id) return false;
      return (
        msg.sender._id === currentUser.id ||
        msg.sender.id === currentUser.id ||
        msg.sender === currentUser.id
      );
    },
    [currentUser?.id]
  );

  const handleScroll = useCallback(
    (event) => {
      scrollHandler.current.handleScroll(event, {
        hasMoreMessages,
        loadingMessages,
        onLoadMore,
        onScrollPositionChange,
        onScroll,
      });
    },
    [
      hasMoreMessages,
      loadingMessages,
      onLoadMore,
      onScrollPositionChange,
      onScroll,
    ]
  );

  useLayoutEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      const newMessages = messages.slice(lastMessageCountRef.current);
      const lastMessage = newMessages[newMessages.length - 1];

      const shouldScroll =
        scrollToBottomOnNewMessage &&
        scrollHandler.current.shouldScrollToBottom(
          lastMessage,
          isMine(lastMessage)
        );

      if (shouldScroll) {
        scrollHandler.current.scrollToBottom("smooth");
      }

      lastMessageCountRef.current = messages.length;
    }
  }, [messages, scrollToBottomOnNewMessage, isMine]);

  useLayoutEffect(() => {
    if (
      !loadingMessages &&
      scrollHandler.current.isLoadingOldMessages.current
    ) {
      if (scrollHandler.current.scrollRestorationRef.current) {
        cancelAnimationFrame(
          scrollHandler.current.scrollRestorationRef.current
        );
      }

      scrollHandler.current.scrollRestorationRef.current =
        requestAnimationFrame(() => {
          scrollHandler.current.restoreScrollPosition(true);
        });
    }
  }, [loadingMessages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options = { passive: true };
    container.addEventListener("scroll", handleScroll, options);

    return () => {
      scrollHandler.current.cleanup();
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      container.removeEventListener("scroll", handleScroll, options);
    };
  }, [handleScroll]);

  useLayoutEffect(() => {
    if (!initialScrollRef.current && messages.length > 0) {
      scrollHandler.current.scrollToBottom("auto");
      initialScrollRef.current = true;

      if (initialLoadRef.current) {
        setTimeout(() => {
          initialLoadRef.current = false;
        }, 1000);
      }
    }
  }, [messages.length]);

  const renderMessage = useCallback(
    (msg, idx) => {
      if (
        !msg ||
        !SystemMessage ||
        !FileMessage ||
        !UserMessage ||
        !AIMessage
      ) {
        console.error("Message component undefined:", {
          msgType: msg?.type,
          hasSystemMessage: !!SystemMessage,
          hasFileMessage: !!FileMessage,
          hasUserMessage: !!UserMessage,
          hasAIMessage: !!AIMessage,
        });
        return null;
      }

      const cacheKey = `${msg._id}-${msg.timestamp}`;
      const cachedMessage = messageCache.current.get(cacheKey);
      if (cachedMessage) return cachedMessage;

      const isLast = idx === allMessages.length - 1;
      const commonProps = {
        currentUser,
        room,
        onReactionAdd,
        onReactionRemove,
      };

      const MessageComponent =
        {
          system: SystemMessage,
          file: FileMessage,
          ai: AIMessage,
        }[msg.type] || UserMessage;

      const renderedMessage = (
        <MessageComponent
          key={msg._id || `msg-${idx}`}
          ref={isLast ? lastMessageRef : null}
          {...commonProps}
          msg={msg}
          content={msg.content}
          isMine={msg.type !== "system" ? isMine(msg) : undefined}
          isStreaming={msg.type === "ai" ? msg.isStreaming || false : undefined}
          messageRef={msg}
          socketRef={socketRef}
        />
      ); // renderMessage 콜백 계속
      messageCache.current.set(cacheKey, renderedMessage);
      return renderedMessage;
    },
    [
      allMessages?.length,
      currentUser,
      room,
      isMine,
      onReactionAdd,
      onReactionRemove,
      socketRef,
    ]
  );

  // 스트리밍 메시지 처리
  useEffect(() => {
    const streamingMessagesArray = Object.values(streamingMessages);
    if (streamingMessagesArray.length > 0) {
      const lastMessage =
        streamingMessagesArray[streamingMessagesArray.length - 1];

      if (
        lastMessage &&
        scrollHandler.current.shouldScrollToBottom(
          lastMessage,
          isMine(lastMessage)
        )
      ) {
        scrollHandler.current.scrollToBottom("smooth");
      }
    }
  }, [streamingMessages, isMine]);

  // 메시지 캐시 클린업
  useEffect(() => {
    const CACHE_SIZE_LIMIT = 200;

    if (messageCache.current.size > CACHE_SIZE_LIMIT) {
      const entries = Array.from(messageCache.current.entries());
      const entriesToDelete = entries.slice(
        0,
        entries.length - CACHE_SIZE_LIMIT
      );
      entriesToDelete.forEach(([key]) => messageCache.current.delete(key));
    }
  }, [messages.length]);

  // 컴포넌트 언마운트 시 클린업
  useEffect(() => {
    return () => {
      messageCache.current.clear();
      scrollHandler.current.cleanup();
    };
  }, []);

  return (
    <div
      className="message-list"
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-atomic="false"
    >
      {loadingMessages && (
        <LoadingIndicator text="이전 메시지를 불러오는 중..." />
      )}

      {!loadingMessages && !hasMoreMessages && messages.length > 0 && (
        <MessageHistoryEnd />
      )}

      {allMessages.length === 0 ? (
        <EmptyMessages />
      ) : (
        allMessages.map((msg, idx) => renderMessage(msg, idx))
      )}

      {messagesEndRef && <div ref={messagesEndRef} />}
    </div>
  );
};

ChatMessages.displayName = "ChatMessages";

export default React.memo(ChatMessages);
