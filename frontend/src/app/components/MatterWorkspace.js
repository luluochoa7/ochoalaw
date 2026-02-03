export default function MatterWorkspace({
  matter,
  documents,
  role,
  onUpload,
  onDownload,
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-white border shadow p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold">{matter.title}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Matter #{matter.id}
            </p>
          </div>

          <span className="rounded-full bg-blue-50 text-blue-700 text-xs px-3 py-1">
            {matter.status}
          </span>
        </div>

        {matter.description && (
          <p className="mt-4 text-slate-700">
            {matter.description}
          </p>
        )}
      </div>

      {/* Documents */}
      <div className="rounded-2xl bg-white border shadow p-6">
        <h2 className="text-lg font-semibold">Documents</h2>

        {role === "lawyer" || role === "client" ? (
          <div className="mt-4">
            <input type="file" onChange={onUpload} />
          </div>
        ) : null}

        <ul className="mt-4 divide-y">
          {documents.length ? (
            documents.map((d) => (
              <li key={d.id} className="py-3 flex justify-between">
                <span className="text-sm">{d.filename}</span>
                <button
                  onClick={() => onDownload(d.id)}
                  className="text-blue-600 text-sm hover:underline"
                >
                  Download
                </button>
              </li>
            ))
          ) : (
            <li className="py-3 text-sm text-slate-500">
              No documents yet
            </li>
          )}
        </ul>
      </div>

      {/* Future sections */}
      <div className="rounded-2xl bg-slate-50 border p-6 text-sm text-slate-500">
        Notes, messages, and AI tools coming next.
      </div>
    </div>
  );
}