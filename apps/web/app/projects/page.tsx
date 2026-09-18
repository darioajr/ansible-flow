import { list } from "@/server/store";
import { Projects } from "@/components/projects";
export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <Projects
      initial={(await list()).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        updatedAt: p.updatedAt,
        playbooks: p.playbooks.length,
      }))}
    />
  );
}
