export function formatDateTime(value) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMessageTime(value) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getMessagePreview(body) {
  if (!body) return "No message content";
  return body.length > 120 ? `${body.slice(0, 120)}...` : body;
}

export function getStatusBadgeClass(status) {
  return `whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
    status === "Closed"
      ? "bg-red-100 text-red-700"
      : status === "Waiting on Client"
      ? "bg-amber-100 text-amber-700"
      : status === "In Progress"
      ? "bg-green-100 text-green-700"
      : "bg-slate-200 text-slate-700"
  }`;
}
