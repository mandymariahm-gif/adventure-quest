"use client";
import { useState } from "react";

export default function RegenerateButton({ eventId }: { eventId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleRegenerate() {
    setStatus("loading");
    try {
      const token = localStorage.getItem("auth_token") ?? "";
      const res = await fetch(`/api/events/${eventId}/regenerate-scrapbook`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStatus("done");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <button
      onClick={handleRegenerate}
      disabled={status === "loading" || status === "done"}
      className="btn-ghost text-xs"
    >
      {status === "idle" && "🔄 Regenerate scrapbook"}
      {status === "loading" && "Regenerating…"}
      {status === "done" && "✅ Done — reloading…"}
      {status === "error" && "❌ Something went wrong"}
    </button>
  );
}