export default function About() {
  return (
    <section className="info-page">
      <div className="page-eyebrow">PLAYBOOK FLOW · 0.2</div>
      <h1>One engine. Two workspaces.</h1>
      <p>
        Design automation visually. Generate real Ansible. Keep everything as
        code.
      </p>
      <dl>
        <dt>Shared by design</dt>
        <dd>
          The Web application and VS Code extension use the same AIR, parser,
          generator, validation rules, module metadata and visual editor.
        </dd>
        <dt>Portable YAML</dt>
        <dd>
          Playbooks run with Ansible independently of this application.
          Unsupported imports are identified and preserved.
        </dd>
        <dt>Roadmap</dt>
        <dd>
          Git, execution, shared credentials, RBAC, AAP/AWX and Operator
          lifecycle are future platform capabilities.
        </dd>
      </dl>
    </section>
  );
}
