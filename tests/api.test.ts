import { beforeEach, afterEach, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { GET, POST, PUT, DELETE } from "../apps/web/app/api/v1/[...path]/route";
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "visual-api-"));
  process.env.DATA_DIR = dir;
});
afterEach(async () => {
  delete process.env.DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});
const request = (
  method: "GET" | "POST" | "PUT" | "DELETE",
  parts: string[],
  data?: unknown,
  origin?: string,
) =>
  ({ GET, POST, PUT, DELETE })[method](
    new Request(`http://localhost/api/v1/${parts.join("/")}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { origin } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
    { params: Promise.resolve({ path: parts }) },
  );
it("creates, persists, reloads, detects concurrent edits and deletes", async () => {
  const p = await (await request("POST", ["projects"], { name: "Web" })).json();
  expect(p.revision).toBe(1);
  p.name = "Changed";
  const responses = await Promise.all([
    request("PUT", ["projects", p.id], p),
    request("PUT", ["projects", p.id], p),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await (await request("GET", ["projects", p.id])).json()).name).toBe(
    "Changed",
  );
  expect((await request("DELETE", ["projects", p.id], {})).status).toBe(204);
  expect((await request("GET", ["projects", p.id])).status).toBe(404);
});
it("imports YAML and refuses unsupported content", async () => {
  const response = await request("POST", ["playbooks", "import"], {
    name: "test.yml",
    yaml: "- hosts: all\n  tasks:\n    - debug: {msg: hello}\n",
  });
  expect(response.status).toBe(200);
  expect((await response.json()).playbook.plays[0].tasks[0].module.fqcn).toBe(
    "ansible.builtin.debug",
  );
  expect(
    (
      await request("POST", ["playbooks", "import"], {
        name: "bad.yml",
        yaml: "- hosts: all\n  import_playbook: other.yml\n",
      })
    ).status,
  ).toBe(422);
});
it("generates, validates, and adds playbooks through versioned APIs", async () => {
  const p = await (
    await request("POST", ["projects"], { name: "Test" })
  ).json();
  const b = p.playbooks[0];
  expect(
    (await (await request("POST", ["playbooks", b.id, "generate"], {})).json())
      .yaml,
  ).toContain("hosts: all");
  expect(
    (await (await request("POST", ["playbooks", b.id, "validate"], {})).json())
      .unavailable,
  ).toContain("ansible-lint");
  expect(
    (
      await (
        await request("POST", ["projects", p.id, "playbooks"], {
          name: "second.yml",
        })
      ).json()
    ).playbooks,
  ).toHaveLength(2);
});
it("enforces body limits, origins, schemas and credential references", async () => {
  expect((await request("POST", ["projects"], { name: "" })).status).toBe(400);
  expect(
    (
      await request(
        "POST",
        ["projects"],
        { name: "X" },
        "https://other.example",
      )
    ).status,
  ).toBe(403);
  expect(
    (await request("POST", ["projects"], { name: "x".repeat(1_000_001) }))
      .status,
  ).toBe(413);
  expect((await request("GET", ["projects", "invalid"])).status).toBe(400);
  const p = await (
    await request("POST", ["projects"], { name: "Test" })
  ).json();
  p.playbooks[0].plays[0].vars = { token: "literal" };
  expect((await request("PUT", ["projects", p.id], p)).status).toBe(422);
});
it("rejects literal credentials before creating an imported project", async () => {
  const response = await request("POST", ["playbooks", "import"], {
    name: "secret.yml",
    yaml: "- hosts: all\n  vars:\n    password: literal\n  tasks: []\n",
  });
  expect(response.status).toBe(422);
  expect(await (await request("GET", ["projects"])).json()).toEqual([]);
});

it.each([
  ["http://localhost:3000", "localhost:3000", 201],
  ["http://127.0.0.1:8081", "127.0.0.1:8081", 201],
  ["http://localhost:3001", "localhost:3000", 403],
  ["https://localhost:3000", "localhost:3000", 403],
  ["https://other.example", "localhost:3000", 403],
  ["null", "localhost:3000", 403],
])(
  "checks browser origin %s against public Host %s",
  async (origin, host, status) => {
    const response = await POST(
      new Request("http://0.0.0.0:3000/api/v1/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host,
          origin,
          "x-forwarded-host": "other.example",
        },
        body: JSON.stringify({ name: "Container" }),
      }),
      { params: Promise.resolve({ path: ["projects"] }) },
    );
    expect(response.status).toBe(status);
  },
);
