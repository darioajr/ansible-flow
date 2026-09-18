import { newProject, newPlaybook } from "@visual-ansible/air";
import {
  createProjectSchema,
  projectSchema,
  importSchema,
  playbookSchema,
} from "@visual-ansible/schemas";
import { assertProject, validatePlaybook } from "@visual-ansible/validator";
import { parsePlaybook } from "@visual-ansible/parser";
import { generateYaml } from "@visual-ansible/generator";
import * as store from "./store";
export async function create(input: unknown) {
  const data = createProjectSchema.parse(input);
  return store.save(newProject(data.name, data.description), true);
}
export async function update(id: string, input: unknown) {
  const p = projectSchema.parse(input);
  if (id !== p.id)
    throw new store.AppError(
      400,
      "ID_MISMATCH",
      "Project ID does not match URL.",
    );
  try {
    assertProject(p);
  } catch (e) {
    throw new store.AppError(422, "INVALID_PROJECT", (e as Error).message);
  }
  return store.save(p);
}
export async function addBook(id: string, input: unknown) {
  const { name } = createProjectSchema.parse(input);
  const p = await store.load(id);
  p.playbooks.push(newPlaybook(name));
  return store.save(p);
}
export function importBook(input: unknown) {
  const { name, yaml } = importSchema.parse(input);
  const result = parsePlaybook(yaml, name);
  if (!result.editable)
    throw new store.AppError(
      422,
      "UNSUPPORTED_YAML",
      "Unsupported YAML construct. Original file was not changed.",
      result.problems,
    );
  const draft = newProject(name);
  draft.playbooks = [result.playbook];
  try {
    assertProject(draft);
  } catch (e) {
    throw new store.AppError(422, "INVALID_PROJECT", (e as Error).message);
  }
  return result;
}
export async function findBook(id: string) {
  for (const p of await store.list()) {
    const book = p.playbooks.find((b) => b.id === id);
    if (book) return book;
  }
  throw new store.AppError(404, "NOT_FOUND", "Playbook not found.");
}
export function generate(input: unknown) {
  const book = playbookSchema.parse(input);
  const problems = validatePlaybook(book);
  if (problems.some((p) => p.severity === "error"))
    throw new store.AppError(
      422,
      "PLAYBOOK_VALIDATION_FAILED",
      "Resolve playbook errors before exporting.",
      problems,
    );
  return { yaml: generateYaml(book), problems };
}
