import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Spinner, Text } from "@goorm-dev/vapor-components";
import { SystemMessage, FileMessage, UserMessage, AIMessage } from "./Message";
import { Virtuoso } from "react-virtuoso";

const SCROLL_THRESHOLD = 150;

const VirtualizedChatMessages = ({
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
}) => {
  const virtuosoRef = useRef(null);
  const loadMoreTriggeredRef = useRef(false);
  const lastMessageCountRef = useRef(messages.length);

  // Combine messages with streaming messages
  const allMessages = useMemo(() => {
    const streamingArray = Object.values(streamingMessages || {});
    return [...messages, ...streamingArray].sort(
      (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
    );
  }, [messages, streamingMessages]);

  // Handle message rendering
  const renderMessage = useCallback(
    (index, msg) => {
      if (!msg) return null;

      const isMine = msg.sender?._id === currentUser?.id;
      const commonProps = {
        currentUser,
        room,
        onReactionAdd,
        onReactionRemove,
        socketRef,
      };

      const MessageComponent =
        {
          system: SystemMessage,
          file: FileMessage,
          ai: AIMessage,
        }[msg.type] || UserMessage;

      return (
        <MessageComponent
          {...commonProps}
          msg={msg}
          content={msg.content}
          isMine={msg.type !== "system" ? isMine : undefined}
          isStreaming={msg.type === "ai" ? msg.isStreaming || false : undefined}
          messageRef={msg}
        />
      );
    },
    [currentUser, room, onReactionAdd, onReactionRemove, socketRef]
  );

  // Handle scroll
  const handleScroll = useCallback(
    (e) => {
      const element = e.target;
      const { scrollTop, scrollHeight, clientHeight } = element;

      // Check if we need to load more messages
      if (
        scrollTop < SCROLL_THRESHOLD &&
        hasMoreMessages &&
        !loadingMessages &&
        !loadMoreTriggeredRef.current
      ) {
        loadMoreTriggeredRef.current = true;
        onLoadMore();
      }

      onScroll({ scrollTop, scrollHeight, clientHeight });
    },
    [hasMoreMessages, loadingMessages, onLoadMore, onScroll]
  );

  // Reset load more trigger when loading state changes
  useEffect(() => {
    if (!loadingMessages) {
      loadMoreTriggeredRef.current = false;
      // Restore scroll position after loading
      if (virtuosoRef.current) {
        const firstItemIndex = messages.length - lastMessageCountRef.current;
        if (firstItemIndex > 0) {
          virtuosoRef.current.scrollToIndex({
            index: firstItemIndex,
            behavior: "auto",
            align: "start",
          });
        }
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [loadingMessages, messages.length]);

  // Always scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      virtuosoRef.current?.scrollToIndex({
        index: allMessages.length - 1,
        behavior: "smooth",
      });
    }
  }, [allMessages.length, messages.length]);

  // Components for different states
  const LoadingComponent = useCallback(
    () =>
      loadingMessages ? (
        <div className="sticky top-0 z-10 flex items-center justify-center p-2 bg-background/80 backdrop-blur-sm">
          <Spinner size="sm" />
          <Text size="sm" className="ml-2">
            이전 메시지를 불러오는 중...
          </Text>
        </div>
      ) : !hasMoreMessages && messages.length > 0 ? (
        <div className="sticky top-0 text-center py-2">
          <Text size="sm" color="secondary">
            더 이상 불러올 메시지가 없습니다.
          </Text>
        </div>
      ) : null,
    [loadingMessages, hasMoreMessages, messages.length]
  );

  const EmptyComponent = useCallback(
    () => (
      <div className="flex flex-col items-center justify-center h-full">
        <Text color="secondary">아직 메시지가 없습니다.</Text>
        <Text color="secondary">첫 메시지를 보내보세요!</Text>
      </div>
    ),
    []
  );

  return (
    <Virtuoso
      ref={virtuosoRef}
      style={{ height: "100%" }}
      data={allMessages}
      itemContent={(index, msg) => renderMessage(index, msg)}
      components={{
        Header: LoadingComponent,
        EmptyPlaceholder: EmptyComponent,
      }}
      overscan={20}
      defaultItemHeight={80}
      increaseViewportBy={{ top: 300, bottom: 300 }}
      onScroll={handleScroll}
      firstItemIndex={0}
      initialTopMostItemIndex={allMessages.length - 1}
      followOutput="smooth"
      alignToBottom
      stick
    />
  );
};

export default React.memo(VirtualizedChatMessages);
