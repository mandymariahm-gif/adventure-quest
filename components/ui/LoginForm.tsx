"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginForm({ next = "/dashboard" }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendLink() {
    if (!email.includes("@")) {
      setState("error");
      setMessage("Enter the email address you'd like your sign-in link sent to.");
      return;
    }
    setState("sending");
    const supabase = supabaseBrowser();
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <div className="ticket p-6 text-center">
        <h2 className="text-xl">Check your email</h2>
        <p className="mt-2 text-sm text-ink/70">
          We sent a sign-in link to <strong>{email}</strong>. Tap it on this
          device and you&apos;re in — no password to remember at a party.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        className="field"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendLink()}
      />
      <button className="btn-primary" onClick={sendLink} disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send magic link"}
      </button>
      {state === "error" && (
        <p role="alert" className="text-sm text-lantern">{message}</p>
      )}
    </div>
  );
}
