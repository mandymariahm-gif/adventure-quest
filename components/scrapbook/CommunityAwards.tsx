"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Award {
  id: string;
  award_code: string;
  award_emoji: string;
  award_label: string;
  winner_user_id: string | null;
  finalized_at: string | null;
}

interface Nomination {
  id: string;
  award_code: string;
  nominated_user_id: string;
  nominated_by_user_id: string;
  photo_id: string | null;
  photo_type: string | null;
  users?: { display_name: string | null } | null;
}

interface Participant {
  user_id: string;
  display_name: string;
}

interface Props {
  eventId: string;
  currentUserId: string;
  participants: Participant[];
  canVote: boolean;
}

export default function CommunityAwards({ eventId, currentUserId, participants, canVote }: Props) {
  const [awards, setAwards] = useState<Award[]>([]);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/awards?eventId=${eventId}`);
      if (res.ok) {
        const { awards: a, nominations: n } = await res.json();
        setAwards(a);
        setNominations(n);
      }
      setLoading(false);
    }
    void load();
  }, [eventId]);

  function nominationCountFor(awardCode: string, userId: string) {
    return nominations.filter(
      (n) => n.award_code === awardCode && n.nominated_user_id === userId
    ).length;
  }

  function myNominationFor(awardCode: string) {
    return nominations.find(
      (n) => n.award_code === awardCode && n.nominated_by_user_id === currentUserId
    );
  }

  function leaderFor(awardCode: string): Participant | null {
    const counts = new Map<string, number>();
    nominations
      .filter((n) => n.award_code === awardCode)
      .forEach((n) => counts.set(n.nominated_user_id, (counts.get(n.nominated_user_id) ?? 0) + 1));
    if (counts.size === 0) return null;
    const topId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return participants.find((p) => p.user_id === topId) ?? null;
  }

  async function nominate(awardCode: string, nominatedUserId: string) {
    setSubmitting(awardCode);
    setError("");
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");

      const res = await fetch("/api/awards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ awardCode, nominatedUserId, eventId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");

      // Update local state
      setNominations((prev) => {
        const filtered = prev.filter(
          (n) => !(n.award_code === awardCode && n.nominated_by_user_id === currentUserId)
        );
        return [...filtered, {
          id: data.nomination.id,
          award_code: awardCode,
          nominated_user_id: nominatedUserId,
          nominated_by_user_id: currentUserId,
          photo_id: null,
          photo_type: null,
        }];
      });
      setExpanded(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(null);
    }
  }

  const otherParticipants = participants.filter((p) => p.user_id !== currentUserId);

  if (loading) return null;

  return (
    <section className="mt-10 px-5" aria-label="Community awards">
      <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">🏅 Community Awards</h2>
      <p className="mt-1 text-xs text-ink/40">
        {canVote ? "Vote for your friends — one nomination per award." : "Final votes from the group."}
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <ul className="mt-4 flex flex-col gap-3">
        {awards.map((award) => {
          const myNom = myNominationFor(award.award_code);
          const leader = leaderFor(award.award_code);
          const nomineeForMe = myNom
            ? participants.find((p) => p.user_id === myNom.nominated_user_id)
            : null;
          const isExpanded = expanded === award.award_code;
          const totalVotes = nominations.filter((n) => n.award_code === award.award_code).length;

          return (
            <li key={award.award_code} className="ticket p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display leading-tight">
                    {award.award_emoji} {award.award_label}
                  </p>
                  {leader && (
                    <p className="mt-0.5 text-xs text-ink/50">
                      Leading: <span className="text-amber">{leader.display_name}</span>
                      {" "}({nominationCountFor(award.award_code, leader.user_id)}/{totalVotes} votes)
                    </p>
                  )}
                  {myNom && nomineeForMe && (
                    <p className="mt-0.5 text-xs text-fern">
                      Your vote: {nomineeForMe.display_name}
                    </p>
                  )}
                </div>
                {canVote && (
                  <button
                    className="btn-paper !min-h-[36px] !px-3 text-xs"
                    onClick={() => setExpanded(isExpanded ? null : award.award_code)}
                  >
                    {myNom ? "Change" : "Vote"}
                  </button>
                )}
              </div>

              {/* Voting dropdown */}
              {isExpanded && canVote && (
                <div className="mt-3 border-t border-ink/10 pt-3">
                  <p className="text-xs text-ink/50 mb-2">Who deserves this?</p>
                  <ul className="flex flex-col gap-1.5">
                    {otherParticipants.map((p) => {
                      const votes = nominationCountFor(award.award_code, p.user_id);
                      const isMyChoice = myNom?.nominated_user_id === p.user_id;
                      return (
                        <li key={p.user_id}>
                          <button
                            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-all
                              ${isMyChoice
                                ? "bg-amber/30 border border-amber/50 text-ink"
                                : "bg-white/10 border border-white/10 text-ink/70 hover:bg-white/20"}
                            `}
                            disabled={submitting === award.award_code}
                            onClick={() => nominate(award.award_code, p.user_id)}
                          >
                            <span className="flex items-center justify-between">
                              <span>{p.display_name}</span>
                              <span className="text-xs text-ink/40">
                                {votes > 0 ? `${votes} vote${votes !== 1 ? "s" : ""}` : ""}
                                {isMyChoice ? " ✓" : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
