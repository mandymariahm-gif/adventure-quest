"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteCodeInput() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function join() {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Paste or type your invite code first.");
      return;
    }
    // Support both a full URL and a bare code
    const match = trimmed.match(/join\/([^/?#]+)/);
    const resolved = match ? match[1] : trimmed;
    router.push(`/join/${resolved}`);
  }

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="font-display text-sm uppercase tracking-[0.25em] text-fern">
        Have an invite?
      </p>
      <p className="mt-1 text-xs text-paper/50">
        Paste your invite link or code below.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          className="field flex-1 !py-2 text-sm"
          placeholder="Paste invite link or code"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && join()}
        />
        <button className="btn-primary !min-h-[40px] !px-4 text-sm" onClick={join}>
          Join
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}
