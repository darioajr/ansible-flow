"use client";
import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Project } from "@visual-ansible/air";
import type { EditorHost } from "@visual-ansible/editor";
import { api, download } from "./api";
const VisualEditor = dynamic(
  () => import("@visual-ansible/editor").then((m) => m.VisualEditor),
  { ssr: false },
);
export function WebEditor({ initial }: { initial: Project }) {
  const router = useRouter();
  const revision = useRef(initial.revision);
  const host = useMemo<EditorHost>(
    () => ({
      kind: "web",
      assetBase: "/monaco",
      autosave: true,
      save: async (project) => {
        const saved = await api<Project>(`projects/${project.id}`, "PUT", {
          ...project,
          revision: revision.current,
        });
        revision.current = saved.revision;
      },
      export: download,
      bindNavigation: (save, isDirty) => {
        const click = (event: MouseEvent) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            !isDirty()
          )
            return;
          const anchor =
            event.target instanceof Element ? event.target.closest("a") : null;
          if (!anchor || anchor.target === "_blank") return;
          const url = new URL(anchor.href, window.location.href);
          if (
            url.origin !== window.location.origin ||
            url.pathname === window.location.pathname
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          void save()
            .then(() => router.push(url.pathname + url.search + url.hash))
            .catch(() => {});
        };
        document.addEventListener("click", click, true);
        return () => document.removeEventListener("click", click, true);
      },
    }),
    [router],
  );
  return <VisualEditor initial={initial} host={host} />;
}
