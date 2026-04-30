import Link from "next/link";
import { useEffect, useRef } from "react";
import InboxEmptyState from "./InboxEmptyState";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import { getStatusBadgeClass } from "./inboxUtils";

export default function InboxConversationView({
  conversation,
  messages,
  messagesLoading,
  messagesError,
  currentUser,
  newMessage,
  onMessageChange,
  onSendMessage,
  sendingMessage,
  onBackToConversations,
  onStartNewMessage,
}) {
  const messagesListRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!messagesLoading && messagesListRef.current) {
      messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
    }
  }, [messages, messagesLoading]);

  if (!conversation) {
    return (
      <section className="flex h-[calc(100dvh-220px)] min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:h-[700px]">
        <div className="flex flex-1 items-center justify-center">
          <InboxEmptyState
            title="Select a conversation."
            description="Select a conversation or start a new secure message."
            action={
              <button
                type="button"
                onClick={onStartNewMessage}
                className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-[#245B83]"
              >
                New Message
              </button>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-[calc(100dvh-220px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[700px]">
      <div className="border-b border-slate-200 p-4 sm:p-6">
        <button
          type="button"
          onClick={onBackToConversations}
          className="mb-3 inline-flex text-sm font-medium text-[#245B83] hover:text-[#183F5F] hover:underline lg:hidden"
        >
          ← Conversations
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-lg font-semibold text-slate-900">
                {conversation.matter_title}
              </h2>
              <span className={getStatusBadgeClass(conversation.matter_status)}>
                {conversation.matter_status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Client: {conversation.client_name || "Unassigned"}
            </p>
          </div>

          <Link
            href={`/portal/lawyer/matters/${conversation.matter_id}#messages`}
            className="inline-flex text-sm font-medium text-[#245B83] hover:text-[#183F5F] hover:underline lg:shrink-0 lg:rounded-lg lg:border lg:border-slate-300 lg:bg-white lg:px-4 lg:py-2.5 lg:text-slate-700 lg:no-underline lg:hover:bg-slate-50"
          >
            Open Workspace
          </Link>
        </div>
      </div>

      <div
        ref={messagesListRef}
        className="flex-1 overflow-y-auto bg-slate-50 p-4"
      >
        {messagesLoading ? (
          <p className="text-sm text-slate-600">Loading messages...</p>
        ) : messagesError && !messages.length ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {messagesError}
          </div>
        ) : messages.length ? (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                currentUserId={currentUser?.id}
              />
            ))}
          </div>
        ) : (
          <InboxEmptyState
            title="No secure messages yet."
            description="Start the conversation with the client regarding this matter."
            action={
              <button
                type="button"
                onClick={() => inputRef.current?.focus()}
                className="rounded-lg bg-[#245B83] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#183F5F]"
              >
                Send First Message
              </button>
            }
          />
        )}
      </div>

      {messagesError && messages.length > 0 && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          {messagesError}
        </p>
      )}

      <MessageInput
        inputRef={inputRef}
        value={newMessage}
        onChange={onMessageChange}
        onSubmit={onSendMessage}
        sending={sendingMessage}
        disabled={sendingMessage || !newMessage.trim()}
      />
    </section>
  );
}
