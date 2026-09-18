export default function Settings() {
  return (
    <section className="info-page">
      <div className="page-eyebrow">WORKSPACE</div>
      <h1>Settings</h1>
      <p>This installation runs in local development mode.</p>
      <dl>
        <dt>Storage</dt>
        <dd>
          Projects persist on the server in DATA_DIR. The file adapter supports
          one process and one replica.
        </dd>
        <dt>Autosave</dt>
        <dd>
          Web edits are saved after one second. VS Code edits use the document’s
          native dirty state and save commands.
        </dd>
        <dt>Authentication</dt>
        <dd>
          Local mode has no login. Use an authenticated reverse proxy for a
          shared installation.
        </dd>
        <dt>Secrets</dt>
        <dd>
          Use Jinja references and supply credentials outside the editor. Do not
          enter sensitive values.
        </dd>
        <dt>Validation</dt>
        <dd>
          The Web checks AIR and bundled metadata. In VS Code, choose a CLI tool
          in Visual Ansible settings; external checks require Workspace Trust
          and run in the active Extension Host.
        </dd>
      </dl>
    </section>
  );
}
