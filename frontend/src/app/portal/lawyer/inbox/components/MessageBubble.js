import { formatMessageTime } from "./inboxUtils";

export default function MessageBubble({ message, currentUserId }) {
  const isLawyerMessage =
    message.sender_role === "lawyer" || message.sender_id === currentUserId;

  return (
    <div className={`flex ${isLawyerMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
          isLawyerMessage
            ? "bg-blue-600 text-white"
            : "border border-slate-200 bg-white text-slate-800"
        }`}
      >
        {!isLawyerMessage && (
          <p className="text-xs font-semibold text-slate-500">
            {message.sender_name || "User"}
          </p>
        )}
        <p
          className={`whitespace-pre-wrap break-words text-sm leading-6 ${
            !isLawyerMessage ? "mt-1" : ""
          }`}
        >
          {message.body}
        </p>
        <p
          className={`mt-1 text-xs ${
            isLawyerMessage ? "text-blue-100" : "text-slate-500"
          }`}
        >
          {formatMessageTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
