"use client";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Title,
  Button,
  Card,
  CardTitle,
  CardBody,
  CardFooter,
  Label,
  SearchInput,
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  TextInput,
  TextArea,
  Alert,
  EmptyState,
  EmptyStateBody,
} from "@patternfly/react-core";
import {
  ProjectDiagramIcon,
  PlusIcon,
  ArrowRightIcon,
  TrashIcon,
  UploadIcon,
} from "@patternfly/react-icons";
import type { Project, Playbook } from "@visual-ansible/air";
import { api } from "./api";
interface Summary {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  playbooks: number;
}
export function Projects({ initial }: { initial: Summary[] }) {
  const [items, setItems] = useState(initial),
    [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [deleting, setDeleting] = useState<Summary | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ name: string; description: string }>();
  async function create(data: { name: string; description: string }) {
    setBusy(true);
    setError("");
    try {
      const p = await api<Project>("projects", "POST", data);
      router.push(`/editor/${p.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function importYaml(input: File) {
    setBusy(true);
    setError("");
    try {
      if (input.size > 1_000_000) throw new Error("Maximum file size is 1 MB.");
      const result = await api<{ playbook: Playbook }>(
        "playbooks/import",
        "POST",
        { name: input.name, yaml: await input.text() },
      );
      const project = await api<Project>("projects", "POST", {
        name: input.name.replace(/\.ya?ml$/, ""),
      });
      project.playbooks = [result.playbook];
      await api(`projects/${project.id}`, "PUT", project);
      router.push(`/editor/${project.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`projects/${deleting.id}`, "DELETE", {});
      setItems(items.filter((p) => p.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="projects-page">
      <div className="page-eyebrow">YOUR AUTOMATION WORKSPACE</div>
      <div className="page-heading">
        <div>
          <Title headingLevel="h1" size="3xl">
            Projects
          </Title>
          <p className="muted">
            Design once. Work in your browser or in VS Code.
          </p>
        </div>
        <div className="project-actions">
          <Button
            variant="secondary"
            icon={<UploadIcon />}
            isDisabled={busy}
            onClick={() => file.current?.click()}
          >
            Import YAML
          </Button>
          <input
            ref={file}
            type="file"
            hidden
            accept=".yml,.yaml"
            aria-label="Import playbook file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importYaml(f);
            }}
          />
          <Button
            icon={<PlusIcon />}
            onClick={() => {
              reset();
              setError("");
              setOpen(true);
            }}
          >
            Create project
          </Button>
        </div>
      </div>
      {error && !open && <Alert isInline title={error} variant="danger" />}
      <div className="workspace-banner">
        <div className="banner-icon">
          <ProjectDiagramIcon />
        </div>
        <div>
          <Label color="blue" isCompact>
            ONE ENGINE. TWO WORKSPACES.
          </Label>
          <h2>From an idea to a playbook.</h2>
          <p>
            Connect modules, configure tasks, and export clean Ansible YAML.
            <br />
            The same visual editor, wherever you build.
          </p>
        </div>
        <div className="mini-flow" aria-hidden="true">
          <span>01 · Install</span>
          <i>↓</i>
          <span>02 · Configure</span>
          <i>↓</i>
          <span>03 · Start service</span>
        </div>
      </div>
      <div className="project-search">
        <div>
          <strong>All projects</strong> <Label isCompact>{items.length}</Label>
        </div>
        <SearchInput
          id="project-search"
          aria-label="Search projects"
          placeholder="Search projects"
          value={query}
          onChange={(_, v) => setQuery(v)}
          onClear={() => setQuery("")}
        />
      </div>
      <div className="project-grid">
        {items
          .filter((p) =>
            `${p.name} ${p.description}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((p) => (
            <Card className="project-card" key={p.id}>
              <CardTitle>
                <div className="project-icon">
                  <ProjectDiagramIcon />
                </div>
                <Link href={`/editor/${p.id}`}>{p.name}</Link>
              </CardTitle>
              <CardBody>
                <p>{p.description || "Ready for your next automation."}</p>
                <Label isCompact>
                  {p.playbooks} playbook{p.playbooks === 1 ? "" : "s"}
                </Label>
              </CardBody>
              <CardFooter>
                <span>Updated {p.updatedAt.slice(0, 10)}</span>
                <Button
                  variant="plain"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => setDeleting(p)}
                >
                  <TrashIcon />
                </Button>
                <Link href={`/editor/${p.id}`} aria-label={`Open ${p.name}`}>
                  <ArrowRightIcon />
                </Link>
              </CardFooter>
            </Card>
          ))}
      </div>
      {!items.length && (
        <EmptyState
          titleText="Start your first automation"
          headingLevel="h2"
          icon={ProjectDiagramIcon}
        >
          <EmptyStateBody>
            Create a project or import an existing playbook to begin.
          </EmptyStateBody>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Create your first project
          </Button>
        </EmptyState>
      )}
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        variant={ModalVariant.small}
        aria-labelledby="project-title"
      >
        <ModalHeader
          title="Create project"
          labelId="project-title"
          description="Give your automation a home."
        />
        <ModalBody>
          {error && <Alert title={error} variant="danger" isInline />}
          <Form id="create-project" onSubmit={handleSubmit(create)}>
            <FormGroup label="Project name" isRequired fieldId="project-name">
              <TextInput
                id="project-name"
                {...register("name", {
                  required: true,
                  maxLength: 200,
                  validate: (v) => !!v.trim(),
                })}
                placeholder="Configure web servers"
                validated={errors.name ? "error" : "default"}
              />
            </FormGroup>
            <FormGroup label="Description" fieldId="project-description">
              <TextArea
                id="project-description"
                {...register("description", { maxLength: 2000 })}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            type="submit"
            form="create-project"
            isDisabled={busy}
            isLoading={busy}
          >
            Create project
          </Button>
          <Button variant="link" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        variant={ModalVariant.small}
        aria-labelledby="delete-title"
      >
        <ModalHeader title="Delete project?" labelId="delete-title" />
        <ModalBody>
          Delete “{deleting?.name}” and its playbooks? This cannot be undone.
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            onClick={() => void remove()}
            isDisabled={busy}
          >
            Delete project
          </Button>
          <Button variant="link" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </section>
  );
}
