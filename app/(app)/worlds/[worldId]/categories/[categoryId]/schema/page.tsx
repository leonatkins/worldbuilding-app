/**
 * The dedicated schema-editor route was folded into the category detail page
 * (step 15b, ADR 0013) — the editor now lives there alongside the members list.
 * This route just redirects, so any lingering deep link still lands somewhere.
 */
import { redirect } from "next/navigation";

type Props = { params: Promise<{ worldId: string; categoryId: string }> };

export default async function CategorySchemaRedirect({ params }: Props) {
  const { worldId, categoryId } = await params;
  redirect(`/worlds/${worldId}/categories/${categoryId}`);
}
