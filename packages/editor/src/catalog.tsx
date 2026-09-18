import { useState } from "react";
import { Button, SearchInput, Label } from "@patternfly/react-core";
import {
  CubeIcon,
  PlusIcon,
  LayerGroupIcon,
  CodeBranchIcon,
  RedoIcon,
} from "@patternfly/react-icons";
import { useEditor } from "./context";
export function Catalog() {
  const [query, setQuery] = useState("");
  const s = useEditor();
  const filtered = s.modules.filter((m) =>
    `${m.fqcn} ${m.label} ${m.category} ${m.description}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <aside className="catalog">
      <div className="panel-title">
        Module catalog <Label isCompact>{s.modules.length}</Label>
      </div>
      <div className="catalog-search">
        <SearchInput
          id="module-search"
          aria-label="Search modules"
          placeholder="Find a module…"
          value={query}
          onChange={(_, v) => setQuery(v)}
          onClear={() => setQuery("")}
        />
      </div>
      <div className="catalog-scroll">
        <div className="collection-name">Available modules & collections</div>
        {[...new Set(filtered.map((m) => m.category))].map((category) => (
          <div key={category}>
            <h3 className="catalog-category">{category}</h3>
            {filtered
              .filter((m) => m.category === category)
              .map((m) => (
                <div
                  key={m.fqcn}
                  className="catalog-item"
                  draggable={s.scope !== "roles"}
                  title={m.description}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/visual-ansible",
                      JSON.stringify({ module: m.fqcn, type: "MODULE" }),
                    );
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <CubeIcon />
                  <div>
                    <strong>{m.label}</strong>
                    <small>{m.fqcn}</small>
                  </div>
                  <Button
                    variant="plain"
                    isDisabled={s.scope === "roles"}
                    aria-label={`Add ${m.label}`}
                    onClick={() => s.add(m.fqcn)}
                  >
                    <PlusIcon />
                  </Button>
                </div>
              ))}
          </div>
        ))}
        {!filtered.length && <p className="empty-note">No matching modules.</p>}
        <h3 className="catalog-category">Structure & behavior</h3>
        {(
          [
            ["ROLE", "Role", LayerGroupIcon],
            ["BLOCK", "Block", LayerGroupIcon],
            ["CONDITION", "Condition", CodeBranchIcon],
            ["LOOP", "Loop", RedoIcon],
          ] as const
        ).map(([type, name, Icon]) => (
          <div
            className="catalog-item"
            key={type}
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData(
                "application/visual-ansible",
                JSON.stringify({ module: "ansible.builtin.debug", type }),
              )
            }
          >
            <Icon />
            <div>
              <strong>{name}</strong>
            </div>
            <Button
              variant="plain"
              isDisabled={s.scope === "roles" && type !== "ROLE"}
              aria-label={`Add ${name}`}
              onClick={() => s.add("ansible.builtin.debug", type)}
            >
              <PlusIcon />
            </Button>
          </div>
        ))}
      </div>
      <p className="catalog-footer">
        Drag modules onto the canvas.
        <br />
        Export standard Ansible YAML.
      </p>
    </aside>
  );
}
