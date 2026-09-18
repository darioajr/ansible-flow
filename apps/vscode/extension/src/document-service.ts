import { parsePlaybook } from "@visual-ansible/parser";
import { generateYaml } from "@visual-ansible/generator";
import { validatePlaybook } from "@visual-ansible/validator";
import { playbookSchema } from "@visual-ansible/schemas";
import type { Problem } from "@visual-ansible/air";
// Shared service used by the actual CustomTextEditorProvider and integration tests.
export function editedDocument(
  currentText: string,
  currentVersion: number,
  expectedVersion: number,
  input: unknown,
): string {
  if (currentVersion !== expectedVersion)
    throw new Error(
      "The document changed outside this editor. Reloaded the latest document; retry your edit.",
    );
  const current = parsePlaybook(currentText);
  if (!current.editable)
    throw new Error(
      "Unsupported YAML construct. Original file is preserved; edit it as text first.",
    );
  const book = playbookSchema.parse(input);
  const proposed = generateYaml({
    ...book,
    source: book.source ?? currentText,
  });
  if (proposed.length > 1_000_000)
    throw new Error("Generated YAML exceeds 1 MB.");
  const parsed = parsePlaybook(proposed);
  if (!parsed.editable)
    throw new Error("Generated document contains unsupported constructs.");
  return proposed;
}
export function documentProblems(text: string): Problem[] {
  const parsed = parsePlaybook(text);
  return [
    ...parsed.problems,
    ...(parsed.editable ? validatePlaybook(parsed.playbook) : []),
  ];
}
