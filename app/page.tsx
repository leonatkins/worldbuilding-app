export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Worldbuilding App</h1>
      <p className="text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
        A world is a collection of subjects; a subject is a collection of facts.
        Capture at the speed of thought — structure crystallizes only where it
        earns its place.
      </p>
      <p className="text-sm text-neutral-500">
        Scaffold in place. Features are not built yet — see{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          docs/ROADMAP.md
        </code>
        .
      </p>
    </main>
  );
}
