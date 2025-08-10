"use client";

import { useState } from "react";

export default function RoleSelector({ initialRole }) {
  const [role, setRole] = useState(initialRole === "lawyer" ? "lawyer" : "client");

  return (
    <div>
      <label className="block text-sm font-medium text-slate-800">I am a</label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setRole("client")}
          className={`rounded-lg border px-4 py-2 ${
            role === "client" ? "border-blue-600 bg-blue-50" : "hover:bg-slate-50"
          }`}
        >
          Client
        </button>
        <button
          type="button"
          onClick={() => setRole("lawyer")}
          className={`rounded-lg border px-4 py-2 ${
            role === "lawyer" ? "border-blue-600 bg-blue-50" : "hover:bg-slate-50"
          }`}
        >
          Lawyer
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Selected: <span className="font-medium">{role}</span>
      </p>
    </div>
  );
}