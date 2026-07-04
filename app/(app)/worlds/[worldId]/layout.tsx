/**
 * Per-world layout (step 12). The one place that has `worldId` in scope above the
 * world's pages (the shared `(app)` layout sits above non-world routes too), so
 * it hosts the persistent global search bar — reachable from the world home,
 * category, subject, and search pages alike. Adds only a thin sub-header; the
 * heavy search work lives behind the bar's debounced preview action.
 */
import { GlobalSearchBar } from "./global-search-bar";

export default async function WorldLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ worldId: string }>;
}) {
  const { worldId } = await params;

  return (
    <>
      <div className="border-b border-neutral-200 px-6 py-2.5 dark:border-neutral-800">
        <div className="mx-auto max-w-2xl">
          <GlobalSearchBar worldId={worldId} />
        </div>
      </div>
      {children}
    </>
  );
}
