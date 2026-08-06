export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl">You&apos;re offline</h1>
      <p className="text-paper/70">
        No signal at the zoo? Your quests, photos, and notes are saved on this
        device and will sync automatically the moment you&apos;re back online.
      </p>
      <a href="/" className="btn-primary">Try again</a>
    </main>
  );
}
