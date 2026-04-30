export default function MessageInput({
  value,
  onChange,
  onSubmit,
  sending,
  disabled,
  inputRef,
}) {
  return (
    <form onSubmit={onSubmit} className="border-t border-slate-200 bg-white p-3">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write a secure message..."
        maxLength={5000}
        className="max-h-40 min-h-[76px] w-full resize-y overflow-y-auto rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-slate-700 focus:ring-slate-700"
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Messages are visible to authorized users on this matter.
        </p>
        <button
          type="submit"
          disabled={disabled}
          className="w-full shrink-0 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {sending ? "Sending..." : "Send Message"}
        </button>
      </div>
    </form>
  );
}
