"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Award {
  award_emoji: string;
  award_label: string;
  winner_display_name: string | null;
}

interface LeaderboardEntry {
  display_name: string;
  quest_points: number;
  curation_points: number;
  total: number;
}

interface Props {
  eventName: string;
  eventId: string;
  totalQuests: number;
  totalPhotos: number;
  totalParticipants: number;
  leaderboard: LeaderboardEntry[];
  awards: Award[];
  champion: LeaderboardEntry | null;
}

export default function FinalReveal({
  eventName, eventId, totalQuests, totalPhotos, totalParticipants,
  leaderboard, awards, champion
}: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const steps = [0, 1, 2, 3, 4, 5];
    steps.forEach((s) => {
      setTimeout(() => setStep(s), s * 800);
    });
  }, []);

  const awardsWithWinners = awards.filter((a) => a.winner_display_name);

  return (
    <main className="mx-auto max-w-md bg-paper text-ink pb-20">
      {/* Hero reveal */}
      <div className={`bg-pine px-5 pb-12 pt-10 text-center text-paper transition-all duration-1000 ${step >= 0 ? "opacity-100" : "opacity-0"}`}>
        <p className="font-display text-xs uppercase tracking-[0.35em] text-fern">🔒 Adventure Complete</p>
        <h1 className={`mt-3 text-4xl leading-tight transition-all duration-700 ${step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {eventName}
        </h1>
        <p className={`mt-2 text-paper/70 transition-all duration-700 delay-300 ${step >= 1 ? "opacity-100" : "opacity-0"}`}>
          Memory Week has ended. Here's your adventure.
        </p>
      </div>

      {/* Stats */}
      <section className={`ticket -mt-6 mx-5 grid grid-cols-3 gap-2 p-4 text-center transition-all duration-700 ${step >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <div>
          <p className="font-display text-3xl">{totalQuests}</p>
          <p className="text-[11px] uppercase tracking-wide text-ink/50">Quests</p>
        </div>
        <div>
          <p className="font-display text-3xl">{totalPhotos}</p>
          <p className="text-[11px] uppercase tracking-wide text-ink/50">Photos</p>
        </div>
        <div>
          <p className="font-display text-3xl">{totalParticipants}</p>
          <p className="text-[11px] uppercase tracking-wide text-ink/50">Adventurers</p>
        </div>
      </section>

      {/* Champion */}
      {champion && (
        <section className={`mx-5 mt-6 rounded-xl bg-amber/20 p-5 text-center transition-all duration-700 ${step >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <p className="font-display text-xs uppercase tracking-[0.25em] text-ink/60">🏆 Adventure Champion</p>
          <p className="mt-2 font-display text-3xl">{champion.display_name}</p>
          <p className="mt-1 text-sm text-ink/60">
            {champion.total} pts total
            {champion.curation_points > 0 && <span className="text-amber"> (+{champion.curation_points} memory bonus)</span>}
          </p>
        </section>
      )}

      {/* Adventure Score leaderboard */}
      {leaderboard.length > 1 && (
        <section className={`mt-8 px-5 transition-all duration-700 ${step >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">Final Adventure Scores</h2>
          <ol className="mt-3 flex flex-col gap-2">
            {leaderboard.map((l, i) => (
              <li key={i} className={`ticket p-3 flex items-center justify-between gap-3 ${i === 0 ? "bg-amber/10 border-amber/30" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg text-ink/30">{i + 1}</span>
                  <div>
                    <p className="font-display text-sm leading-tight">{l.display_name}</p>
                    <p className="text-xs text-ink/40">
                      {l.quest_points} quest{l.curation_points > 0 ? ` + ${l.curation_points} memory` : ""}
                    </p>
                  </div>
                </div>
                <span className="font-display text-xl text-amber">{l.total}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Community Awards */}
      {awardsWithWinners.length > 0 && (
        <section className={`mt-8 px-5 transition-all duration-700 ${step >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">🏅 Community Awards</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {awardsWithWinners.map((award, i) => (
              <li key={i} className="ticket p-3 flex items-center justify-between">
                <span className="text-sm">{award.award_emoji} {award.award_label}</span>
                <span className="font-display text-sm text-amber">{award.winner_display_name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CTA */}
      <div className={`mt-10 px-5 flex flex-col gap-3 transition-all duration-700 ${step >= 5 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <Link href={`/scrapbook/${eventId}`} className="btn-primary text-center">
          Open the full scrapbook
        </Link>
        <Link href="/dashboard" className="btn-ghost text-center">
          Back to dashboard
        </Link>
        <p className="text-center text-xs text-ink/30 mt-2">
          Made together. See you next year. 🦁
        </p>
      </div>
    </main>
  );
}
