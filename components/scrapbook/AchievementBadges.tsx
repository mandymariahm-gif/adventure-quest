interface Achievement {
  code: string;
  name: string;
  icon: string | null;
  description: string | null;
  earned_at: string;
}

interface Props {
  achievements: Achievement[];
  displayName: string;
}

export default function AchievementBadges({ achievements, displayName }: Props) {
  if (achievements.length === 0) return null;

  return (
    <section className="mt-8 px-5" aria-label="Achievements">
      <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">
        🎖️ {displayName}&apos;s Achievements
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {achievements.map((a) => (
          <div
            key={a.code}
            className="flex items-center gap-1.5 rounded-full bg-amber/20 border border-amber/30 px-3 py-1.5"
            title={a.description ?? a.name}
          >
            <span className="text-base">{a.icon ?? "🏆"}</span>
            <span className="font-display text-xs text-ink/80">{a.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
