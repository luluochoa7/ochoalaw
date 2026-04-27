import { useState } from "react";
import { sendMatterMessage } from "../../../../lib/auth";

export default function NewMessagePanel({
  matters,
  mattersLoading,
  mattersError,
  onCancel,
  onSent,
}) {
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (sending) return;

    const trimmed = body.trim();
    if (!selectedMatterId) {
      setError("Choose a matter first.");
      return;
    }
    if (!trimmed) {
      setError("Write a message first.");
      return;
    }

    try {
      setSending(true);
      setError("");
      const created = await sendMatterMessage(selectedMatterId, trimmed);
      setBody("");
      setSelectedMatterId("");
      await onSent?.({
        matterId: Number(selectedMatterId),
        message: created,
      });
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex h-[calc(100dvh-220px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border bg-white shadow-xl lg:h-[700px]">
      <div className="border-b border-slate-200 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              New Secure Message
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Start a matter-specific conversation with a client.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6"
      >
        <div>
          <label className="block text-sm font-medium text-slate-800">
            Matter
          </label>
          <select
            value={selectedMatterId}
            onChange={(e) => setSelectedMatterId(e.target.value)}
            disabled={mattersLoading || !matters.length}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-blue-600 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">
              {mattersLoading ? "Loading matters..." : "Choose a matter..."}
            </option>
            {matters.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.title || `Matter #${matter.id}`}
                {matter.client_name ? ` - ${matter.client_name}` : ""}
              </option>
            ))}
          </select>
          {!mattersLoading && !matters.length && (
            <p className="mt-2 text-sm text-slate-500">
              No matters are available for messaging yet.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800">
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a secure message..."
            maxLength={5000}
            className="mt-2 min-h-[160px] w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600"
          />
        </div>

        {(error || mattersError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || mattersError}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending || !selectedMatterId || !body.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send Message"}
          </button>
        </div>
      </form>
    </section>
  );
}
