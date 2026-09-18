import { notFound } from "next/navigation";
import { z } from "zod";
import { load, AppError } from "@/server/store";
import { WebEditor } from "@/components/web-editor";
export const dynamic = "force-dynamic";
export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const project = await load(id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  return <WebEditor initial={project} />;
}
