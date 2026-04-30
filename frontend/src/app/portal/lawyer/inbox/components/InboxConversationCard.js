import {
  formatDateTime,
  getMessagePreview,
  getStatusBadgeClass,
} from "./inboxUtils";

export default function InboxConversationCard({ item, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`block w-full rounded-xl border p-4 text-left shadow-sm transition ${
        selected
          ? "border-slate-500 bg-slate-50/80"
          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-sm font-semibold text-slate-900">
              {item.matter_title}
            </p>
            <span className={getStatusBadgeClass(item.matter_status)}>
              {item.matter_status}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Client: {item.client_name || "Unassigned"}
          </p>
        </div>
        <p className="shrink-0 text-xs text-slate-500">
          {formatDateTime(item.latest_message_created_at)}
        </p>
      </div>

      <p className="mt-3 break-words text-sm leading-6 text-slate-700">
        <span className="font-medium text-slate-900">
          {item.latest_message_sender_name || "User"}:
        </span>{" "}
        {getMessagePreview(item.latest_message_body)}
      </p>
    </button>
  );
}
