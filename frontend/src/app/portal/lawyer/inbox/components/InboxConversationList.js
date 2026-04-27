import InboxConversationCard from "./InboxConversationCard";
import InboxEmptyState from "./InboxEmptyState";

export default function InboxConversationList({
  items,
  loading,
  error,
  selectedMatterId,
  onSelectConversation,
}) {
  return (
    <section className="flex h-[calc(100dvh-220px)] min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[700px]">
      <div className="border-b border-slate-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Recent Conversations
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Conversations are organized by matter.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-slate-600">Loading inbox...</p>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : items.length ? (
          <div className="space-y-3">
            {items.map((item) => (
              <InboxConversationCard
                key={item.matter_id}
                item={item}
                selected={selectedMatterId === item.matter_id}
                onSelect={onSelectConversation}
              />
            ))}
          </div>
        ) : (
          <InboxEmptyState
            title="No conversations yet."
            description="Messages across client matters will appear here."
          />
        )}
      </div>
    </section>
  );
}
