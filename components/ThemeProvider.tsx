type Theme = {
  pine?: string;
  moss?: string;
  fern?: string;
  amber?: string;
  lantern?: string;
  paper?: string;
  ink?: string;
};

export default function ThemeProvider({
  theme,
  children,
}: {
  theme: Theme | null;
  children: React.ReactNode;
}) {
  if (!theme) return <>{children}</>;

  const styleVars: Record<string, string> = {};
  if (theme.pine) styleVars["--color-pine"] = theme.pine;
  if (theme.moss) styleVars["--color-moss"] = theme.moss;
  if (theme.fern) styleVars["--color-fern"] = theme.fern;
  if (theme.amber) styleVars["--color-amber"] = theme.amber;
  if (theme.lantern) styleVars["--color-lantern"] = theme.lantern;
  if (theme.paper) styleVars["--color-paper"] = theme.paper;
  if (theme.ink) styleVars["--color-ink"] = theme.ink;

  return (
    <div
      style={styleVars as React.CSSProperties}
      className="min-h-dvh bg-pine"
    >
      {children}
    </div>
  );
}
