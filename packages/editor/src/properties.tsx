import { useState, useEffect, useRef } from "react";
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
import { type Parameter } from "@visual-ansible/module-metadata";
import { useEditor } from "./context";
import { currentPlay, nodesIn } from "./store";
export function JsonField({
  label,
  value,
  change,
  object = false,
  validate,
  expandToContent = false,
}: {
  label: string;
  value: Json | undefined;
  change: (v: Json | undefined) => void;
  object?: boolean;
  validate?: (v: Json) => boolean;
  expandToContent?: boolean;
}) {
  const [text, setText] = useState(
    value === undefined ? "" : JSON.stringify(value, null, 2),
  );
  const [error, setError] = useState(false);
  const committed = useRef<string | undefined>(JSON.stringify(value));
  useEffect(() => {
    const serialized = JSON.stringify(value);
    if (committed.current !== serialized) {
      committed.current = serialized;
      setText(value === undefined ? "" : JSON.stringify(value, null, 2));
      setError(false);
    }
  }, [value]);
  return (
    <FormGroup label={label}>
      <TextArea
        aria-label={label}
        rows={
          expandToContent
            ? Math.min(14, Math.max(6, text.split("\n").length))
            : 3
        }
        resizeOrientation={expandToContent ? "vertical" : "both"}
        value={text}
        validated={error ? "error" : "default"}
        className={
          expandToContent ? "json-field json-field-expanded" : "json-field"
        }
        onChange={(_, v) => {
          setText(v);
          try {
            if (!v.trim()) {
              committed.current = undefined;
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
            committed.current = JSON.stringify(parsed);
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
          expandToContent
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
  const module = s.modules.find((m) => m.fqcn === node.module?.fqcn);
  function argument(key: string, value: Json | undefined) {
    if (!node.module) return;
    const args = { ...node.module.args };
    for (const alias of module?.parameters[key]?.aliases ?? [])
      delete args[alias];
    if (value === undefined) delete args[key];
    else args[key] = value;
    patch({ module: { ...node.module, args } });
  }
  if (node.type === "ROLE")
    return (
      <aside className="properties">
        <div className="panel-title">
          Role properties{" "}
          <Button variant="plain" aria-label="Delete role" onClick={s.remove}>
            <TrashIcon />
          </Button>
        </div>
        <Form className="properties-form">
          <FormGroup label="Role name" isRequired>
            <TextInput
              aria-label="Role name"
              value={node.role?.name ?? ""}
              onChange={(_, name) =>
                patch({
                  name,
                  role: { name, options: node.role?.options ?? {} },
                })
              }
            />
          </FormGroup>
          <JsonField
            label="Role options and variables (JSON object)"
            object
            value={node.role?.options}
            validate={(v) => !Object.hasOwn(v as object, "role")}
            change={(options) =>
              patch({
                role: {
                  name: node.role!.name,
                  options: (options ?? {}) as Record<string, Json>,
                },
              })
            }
          />
          <p className="property-note">
            Roles run after pre-tasks and before tasks. Configure vars, tags,
            when and role parameters here. Role files remain in your Ansible
            project.
          </p>
          <Button variant="secondary" onClick={s.duplicate}>
            Duplicate role
          </Button>
        </Form>
      </aside>
    );
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
          <>
            <Button
              variant="secondary"
              onClick={() => s.navigate(s.bookId, s.playId, node.id)}
            >
              Edit block tasks ({node.children?.length ?? 0})
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                s.navigate(s.bookId, s.playId, `${node.id}:rescue`)
              }
            >
              Edit rescue tasks ({node.rescue?.length ?? 0})
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                s.navigate(s.bookId, s.playId, `${node.id}:always`)
              }
            >
              Edit always tasks ({node.always?.length ?? 0})
            </Button>
            <p className="property-note">
              Rescue handles task failures; always runs after block/rescue.
              These are separate sequences, not parallel branches.
            </p>
          </>
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
                {s.modules.map((m) => (
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
            {module && (
              <JsonField
                label="All arguments (JSON object)"
                expandToContent
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
            )}
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
                  value={
                    node.module?.args[key] ??
                    param.aliases
                      ?.map((alias) => node.module?.args[alias])
                      .find((value) => value !== undefined)
                  }
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
        <JsonField
          label="Task variables (JSON object)"
          object
          value={node.extra?.vars}
          change={(vars) => {
            const extra = { ...node.extra };
            if (vars === undefined) delete extra.vars;
            else extra.vars = vars;
            patch({ extra });
          }}
        />
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
