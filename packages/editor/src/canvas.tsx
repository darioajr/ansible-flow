import { useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  MarkerType,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Button, Label } from "@patternfly/react-core";
import { CubeIcon, LayerGroupIcon, BoltIcon } from "@patternfly/react-icons";
import type { AutomationNode, NodeType } from "@visual-ansible/air";
import { useEditor } from "./context";
import { currentPlay, nodesIn } from "./store";
type TaskNode = Node<{ task: AutomationNode; index: number }, "task">;
function Task({ data, selected }: NodeProps<TaskNode>) {
  const s = useEditor();
  const n = data.task;
  return (
    <div className={`task-node ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="task-header">
        <span className="task-icon">
          {n.type === "BLOCK" ? (
            <LayerGroupIcon />
          ) : n.type === "HANDLER" ? (
            <BoltIcon />
          ) : (
            <CubeIcon />
          )}
        </span>
        <span>
          {n.type === "HANDLER"
            ? "HANDLER"
            : n.type === "BLOCK"
              ? "BLOCK"
              : n.type === "ROLE"
                ? "ROLE"
                : `TASK ${String(data.index + 1).padStart(2, "0")}`}
        </span>
        <span className="task-grip">⠿</span>
      </div>
      <strong className="task-name">{n.name || "Untitled task"}</strong>
      <p className="task-module">
        {n.role?.name ??
          n.module?.fqcn ??
          `${n.children?.length ?? 0} block · ${n.rescue?.length ?? 0} rescue · ${n.always?.length ?? 0} always`}
      </p>
      {(n.when !== undefined || n.loop !== undefined) && (
        <div className="task-badges">
          {n.when !== undefined && (
            <Label color="orange" isCompact>
              when
            </Label>
          )}
          {n.loop !== undefined && (
            <Label color="purple" isCompact>
              loop
            </Label>
          )}
        </div>
      )}
      {n.notify?.length ? (
        <div className="task-notify">↳ notify: {n.notify.join(", ")}</div>
      ) : null}
      {n.type === "BLOCK" && (
        <Button
          variant="link"
          className="nodrag"
          size="sm"
          onClick={() => s.navigate(s.bookId, s.playId, n.id)}
        >
          Open block →
        </Button>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const nodeTypes = { task: Task };
function Flow() {
  const s = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const list = nodesIn(currentPlay(s), s.scope);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const nodes = useMemo<TaskNode[]>(
    () =>
      list.map((task, i) => ({
        id: task.id,
        type: "task",
        position: positions[task.id] ??
          s.project.layout[task.id] ?? { x: 80, y: 60 + i * 200 },
        data: { task, index: i },
        selected: s.selection.includes(task.id),
      })),
    [list, positions, s.project.layout, s.selection],
  );
  const edges = useMemo(
    () =>
      list.slice(1).map((n, i) => ({
        id: `${list[i].id}-${n.id}`,
        source: list[i].id,
        target: n.id,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        deletable: false,
      })),
    [list],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      void fitView({ padding: 0.25, maxZoom: 1 });
    }, 60);
    return () => clearTimeout(timer);
  }, [list.length, fitView]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void fitView({ padding: 0.25, maxZoom: 1 });
      }, 60);
    });
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [fitView]);
  return (
    <div
      ref={ref}
      className="flow-canvas"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        e.preventDefault();
        try {
          const value = JSON.parse(
            e.dataTransfer.getData("application/visual-ansible"),
          );
          if (
            !s.modules.some((m) => m.fqcn === value.module) ||
            !["MODULE", "BLOCK", "CONDITION", "LOOP", "ROLE"].includes(
              value.type,
            )
          )
            return;
          s.add(
            value.module,
            value.type as NodeType,
            screenToFlowPosition({ x: e.clientX, y: e.clientY }),
          );
        } catch {
          /* Ignore unrelated drag data. */
        }
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        onNodesChange={(changes) => {
          const selected = new Set(s.selection);
          let changed = false;
          for (const c of changes) {
            if (c.type === "position" && c.position)
              setPositions((p) => ({ ...p, [c.id]: c.position! }));
            if (c.type === "select") {
              changed = true;
              if (c.selected) selected.add(c.id);
              else selected.delete(c.id);
            }
          }
          if (changed) s.select([...selected]);
        }}
        onNodeDragStop={(_, n) => {
          s.edit((p) => {
            Object.assign(p.layout, positions);
            p.layout[n.id] = n.position;
          });
          setPositions({});
        }}
        onPaneClick={() => s.select([])}
        onConnect={(c) => {
          if (c.source !== c.target) s.connect(c.source, c.target);
        }}
        isValidConnection={(c) => c.source !== c.target}
        deleteKeyCode={null}
        selectionOnDrag
        multiSelectionKeyCode={["Meta", "Control"]}
        minZoom={0.25}
        maxZoom={1.8}
        snapToGrid
        snapGrid={[16, 16]}
      >
        <Background gap={24} size={1.2} color="#d6e0ed" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
      {!list.length && (
        <div className="canvas-empty">
          <CubeIcon />
          <h3>Your automation starts here</h3>
          <p>
            Drag a module from the catalog,
            <br />
            or click + to add your first task.
          </p>
        </div>
      )}
      <div className="canvas-caption">
        {list.length} tasks · Connect to set execution order
      </div>
    </div>
  );
}
export function Canvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
