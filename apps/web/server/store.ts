import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  rename,
  unlink,
  access,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { projectSchema } from "@visual-ansible/schemas";
import type { Project } from "@visual-ansible/air";
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown[] = [],
  ) {
    super(message);
  }
}
const directory = () => path.resolve(process.env.DATA_DIR ?? "./data");
const file = (id: string) => {
  z.uuid().parse(id);
  return path.join(directory(), `${id}.json`);
};
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>) {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}
export async function ready() {
  await mkdir(directory(), { recursive: true, mode: 0o770 });
  await access(directory(), 6);
}
export async function load(id: string): Promise<Project> {
  try {
    return projectSchema.parse(JSON.parse(await readFile(file(id), "utf8")));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      throw new AppError(404, "NOT_FOUND", "Project not found.");
    throw e;
  }
}
export async function list() {
  await ready();
  const files = (await readdir(directory())).filter((n) =>
    /^[\da-f-]{36}\.json$/.test(n),
  );
  return (await Promise.all(files.map((n) => load(n.slice(0, -5))))).sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );
}
export async function save(project: Project, create = false) {
  return exclusive(async () => {
    await ready();
    const target = file(project.id);
    if (create) {
      try {
        await access(target);
        throw new AppError(409, "CONFLICT", "Project already exists.");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    } else if ((await load(project.id)).revision !== project.revision)
      throw new AppError(
        409,
        "CONFLICT",
        "Project changed in another editor. Reload to reconcile changes.",
      );
    const next = {
      ...project,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    const temp = `${target}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o660 });
      await rename(temp, target);
    } finally {
      await unlink(temp).catch(() => {});
    }
    return next;
  });
}
export async function remove(id: string) {
  return exclusive(async () => {
    await load(id);
    await unlink(file(id));
  });
}
