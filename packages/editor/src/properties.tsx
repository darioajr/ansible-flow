import { useState } from "react";
import {
  Form,
  FormGroup,
  TextInput,
  TextArea,
  FormSelect,
  FormSelectOption,
  Checkbox,
  Button,
} from "@patternfly/react-core";
import { CloneIcon, TrashIcon } from "@patternfly/react-icons";
import type { Json, AutomationNode } from "@visual-ansible/air";
import {
  modules,
  getModule,
  type Parameter,
} from "@visual-ansible/module-metadata";
import { useEditor } from "./context";
import { currentPlay, nodesIn } from "./store";
export function JsonField({
  label,
  value,
  change,
  object = false,
  validate,
}: {
  label: string;
  value: Json | undefined;
  change: (v: Json | undefined) => void;
  object?: boolean;
  validate?: (v: Json) => boolean;
}) {
  const [text, setText] = useState(
    value === undefined ? "" : JSON.stringify(value, null, 2),
  );
  const [error, setError] = useState(false);
  return (
    <FormGroup label={label}>
      <TextArea
        aria-label={label}
        rows={3}
        value={text}
        validated={error ? "error" : "default"}
        className="json-field"
        onChange={(_, v) => {
          setText(v);
          try {
            if (!v.trim()) {
              change(undefined);
              setError(false);
              return;
            }
            const parsed: Json = JSON.parse(v);
            if (
              object &&
              (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            )
              throw Error();
            if (validate && !validate(parsed)) throw Error();
            change(parsed);
            setError(false);
          } catch {
            setError(true);
          }
        }}
      />
      {error && (
        <small className="field-error">
          Enter valid JSON with the expected value type.
        </small>
      )}
    </FormGroup>
  );
}
function Argument({
  name,
  param,
  value,
  change,
}: {
  name: string;
  param: Parameter;
  value: Json | undefined;
  change: (v: Json | undefined) => void;
}) {
  const label = `${param.label} (${name})`;
  if (param.type === "json" || (param.acceptsList && Array.isArray(value)))
    return <JsonField label={label} value={value} change={change} />;
  if (param.type === "boolean")
    return (
      <FormGroup label={param.label}>
        <FormSelect
          aria-label={label}
          value={value === undefined ? "" : String(value)}
          onChange={(_, v) => change(v === "" ? undefined : v === "true")}
        >
          <FormSelectOption label="Default" value="" />
          <FormSelectOption label="Yes" value="true" />
          <FormSelectOption label="No" value="false" />
        </FormSelect>
      </FormGroup>
    );
  return (
    <FormGroup label={param.label} isRequired={param.required}>
      <TextInput
        aria-label={label}
        type={param.type === "number" ? "number" : "text"}
        list={param.options ? `choices-${name}` : undefined}
        value={
          typeof value === "string" || typeof value === "number"
            ? String(value)
            : ""
        }
        placeholder={name === "mode" ? "0644" : name}
        onChange={(_, v) =>
          change(v === "" ? undefined : param.type === "number" ? Number(v) : v)
        }
      />
      {param.options && (
        <datalist id={`choices-${name}`}>
          {param.options.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}
    </FormGroup>
  );
}
export function Properties() {
  const s = useEditor();
  const play = currentPlay(s)!;
  const node = nodesIn(play, s.scope).find((n) => n.id === s.selection[0]);
  if (node) return <TaskProperties key={node.id} node={node} />;
  return (
    <aside className="properties">
      <div className="panel-title">Play properties</div>
      <Form className="properties-form">
        <FormGroup label="Play name">
          <TextInput
            aria-label="Play name"
            value={play.name}
            onChange={(_, name) =>
              s.edit((p) => {
                currentPlay({ ...s, project: p })!.name = name;
              })
            }
          />
        </FormGroup>
        <FormGroup label="Target hosts" isRequired>
          <TextInput
            aria-label="Target hosts"
            value={play.hosts}
            onChange={(_, hosts) =>
              s.edit((p) => {
                currentPlay({ ...s, project: p })!.hosts = hosts;
              })
            }
          />
        </FormGroup>
        <Checkbox
          id="play-become"
          label="Privilege escalation (become)"
          isChecked={play.become ?? false}
          onChange={(_, become) =>
            s.edit((p) => {
              currentPlay({ ...s, project: p })!.become = become;
            })
          }
        />
        <JsonField
          label="Play variables (JSON)"
          value={play.vars}
          object
          change={(vars) =>
            s.edit((p) => {
              currentPlay({ ...s, project: p })!.vars = (vars ?? {}) as Record<
                string,
                Json
              >;
            })
          }
        />
        <div className="property-note">
          Select a task to configure its module arguments and behavior.
        </div>
      </Form>
    </aside>
  );
}
function TaskProperties({ node }: { node: AutomationNode }) {
  const s = useEditor();
  const patch = (p: Partial<AutomationNode>) => s.patch(node.id, p);
  const module = getModule(node.module?.fqcn ?? "");
  function argument(key: string, value: Json | undefined) {
    if (!node.module) return;
    const args = { ...node.module.args };
    if (value === undefined) delete args[key];
    else args[key] = value;
    patch({ module: { ...node.module, args } });
  }
  return (
    <aside className="properties">
      <div className="panel-title">
        Task properties{" "}
        <span>
          <Button
            variant="plain"
            aria-label="Duplicate task"
            onClick={s.duplicate}
          >
            <CloneIcon />
          </Button>
          <Button variant="plain" aria-label="Delete task" onClick={s.remove}>
            <TrashIcon />
          </Button>
        </span>
      </div>
      <div className="property-module">
        {node.type === "BLOCK" ? "Task block" : node.module?.fqcn}
      </div>
      <Form className="properties-form">
        <FormGroup label="Task name" isRequired>
          <TextInput
            aria-label="Task name"
            value={node.name}
            onChange={(_, name) => patch({ name })}
          />
        </FormGroup>
        {node.type === "BLOCK" ? (
          <Button
            variant="secondary"
            onClick={() => s.navigate(s.bookId, s.playId, node.id)}
          >
            Edit block tasks ({node.children?.length ?? 0})
          </Button>
        ) : (
          <>
            <FormGroup label="Module">
              <FormSelect
                aria-label="Module"
                value={node.module?.fqcn ?? ""}
                onChange={(_, fqcn) => patch({ module: { fqcn, args: {} } })}
              >
                {!module && node.module && (
                  <FormSelectOption
                    value={node.module.fqcn}
                    label={node.module.fqcn}
                  />
                )}
                {modules.map((m) => (
                  <FormSelectOption
                    key={m.fqcn}
                    value={m.fqcn}
                    label={m.fqcn}
                  />
                ))}
              </FormSelect>
            </FormGroup>
            <p className="muted small">{module?.description}</p>
            <h3 className="form-section">MODULE ARGUMENTS</h3>
            {module?.label === "set_fact" || !module ? (
              <JsonField
                label="Arguments (JSON object)"
                object
                value={node.module?.args}
                change={(args) =>
                  patch({
                    module: {
                      fqcn: node.module!.fqcn,
                      args: (args ?? {}) as Record<string, Json>,
                    },
                  })
                }
              />
            ) : (
              Object.entries(module.parameters).map(([key, param]) => (
                <Argument
                  key={`${node.module?.fqcn}-${key}`}
                  name={key}
                  param={param}
                  value={node.module?.args[key]}
                  change={(v) => argument(key, v)}
                />
              ))
            )}
          </>
        )}
        <h3 className="form-section">TASK BEHAVIOR</h3>
        <FormGroup label="Condition (when)">
          <TextInput
            aria-label="Condition (when)"
            placeholder="ansible_facts.os_family == 'RedHat'"
            value={
              Array.isArray(node.when)
                ? node.when.join(" and ")
                : String(node.when ?? "")
            }
            onChange={(_, when) => patch({ when: when || undefined })}
          />
        </FormGroup>
        {node.type !== "BLOCK" && (
          <>
            <JsonField
              label="Loop (JSON array or quoted Jinja expression)"
              value={node.loop}
              validate={(v) => Array.isArray(v) || typeof v === "string"}
              change={(loop) => patch({ loop: loop as AutomationNode["loop"] })}
            />
            <FormGroup label="Register result">
              <TextInput
                aria-label="Register result"
                value={node.register ?? ""}
                onChange={(_, v) => patch({ register: v || undefined })}
              />
            </FormGroup>
          </>
        )}
        {(["notify", "tags"] as const).map((key) => (
          <FormGroup
            key={key}
            label={key === "notify" ? "Notify handlers" : "Tags"}
          >
            <TextInput
              aria-label={key === "notify" ? "Notify handlers" : "Tags"}
              value={node[key]?.join(", ") ?? ""}
              placeholder={
                key === "notify" ? "Restart nginx" : "web, configuration"
              }
              onChange={(_, v) =>
                patch({
                  [key]: v ? v.split(",").map((v) => v.trim()) : undefined,
                })
              }
            />
            <small className="muted">Comma-separated values.</small>
          </FormGroup>
        ))}
        <details>
          <summary>Advanced behavior</summary>
          <div className="advanced-fields">
            {(["become", "ignore_errors", "run_once"] as const).map((key) => (
              <FormGroup key={key} label={key}>
                <FormSelect
                  aria-label={key}
                  value={node[key] === undefined ? "" : String(node[key])}
                  onChange={(_, v) =>
                    patch({ [key]: v === "" ? undefined : v === "true" })
                  }
                >
                  <FormSelectOption value="" label="Inherit / default" />
                  <FormSelectOption value="true" label="True" />
                  <FormSelectOption value="false" label="False" />
                </FormSelect>
              </FormGroup>
            ))}
            {(["changed_when", "failed_when", "delegate_to"] as const).map(
              (key) => (
                <FormGroup label={key} key={key}>
                  <TextInput
                    aria-label={key}
                    value={String(node[key] ?? "")}
                    onChange={(_, v) => patch({ [key]: v || undefined })}
                  />
                </FormGroup>
              ),
            )}
            <JsonField
              label="Environment (JSON object)"
              object
              value={node.environment}
              change={(v) =>
                patch({ environment: v as Record<string, Json> | undefined })
              }
            />
          </div>
        </details>
      </Form>
    </aside>
  );
}
