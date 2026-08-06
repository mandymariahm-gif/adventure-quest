"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginForm({ next = "/dashboard" }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    setError("");
    const supabase = supabaseBrowser();

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError(signInError.message); setLoading(false); return; }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className="field"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          className="field"
          placeholder={isSignUp ? "Choose a password (6+ characters)" : "Your password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handle()}
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button className="btn-primary" onClick={handle} disabled={loading}>
        {loading ? "..." : isSignUp ? "Create account" : "Sign in"}
      </button>
      <button
        className="btn-ghost text-sm"
        onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
      >
        {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </div>
  );
}