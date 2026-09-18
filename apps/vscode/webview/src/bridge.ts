import type { Playbook } from "@visual-ansible/air";
import {
  hostMessageSchema,
  type HostMessage,
  type WebviewMessage,
} from "@visual-ansible/schemas";
export class DocumentBridge {
  private pending = new Map<
    string,
    {
      resolve: (message: HostMessage) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private queue: Promise<void> = Promise.resolve();
  private version = 1;
  private epoch = 0;
  constructor(
    private send: (message: WebviewMessage) => void,
    private receiveDocument: (
      message: Extract<HostMessage, { type: "document" }>,
    ) => void,
    private report: (message: HostMessage) => void,
  ) {}
  ready() {
    this.send({ type: "ready" });
  }
  receive(input: unknown) {
    const parsed = hostMessageSchema.safeParse(input);
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.type === "document") {
      this.version = message.version;
      if (!message.requestId) {
        this.epoch++;
        this.receiveDocument(message);
      }
      return;
    }
    if (message.type === "result") {
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.requestId);
      if (message.version) this.version = message.version;
      if (message.ok) pending.resolve(message);
      else
        pending.reject(new Error(message.message ?? "VS Code request failed."));
      return;
    }
    this.report(message);
  }
  private request(
    message: Extract<WebviewMessage, { requestId: string }>,
  ): Promise<HostMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(message.requestId);
        reject(
          new Error("The Extension Host did not respond. Reopen this editor."),
        );
      }, 30000);
      this.pending.set(message.requestId, { resolve, reject, timer });
      this.send(message);
    });
  }
  edit(book: Playbook): Promise<void> {
    const epoch = this.epoch;
    const snapshot = structuredClone(book);
    const next = this.queue
      .catch(() => {})
      .then(async () => {
        if (epoch !== this.epoch)
          throw new Error(
            "Document changed externally. Retry on the latest version.",
          );
        await this.request({
          type: "edit",
          requestId: crypto.randomUUID(),
          version: this.version,
          playbook: snapshot,
        });
      });
    this.queue = next;
    return next;
  }
  async save(book: Playbook) {
    await this.edit(book);
    await this.request({ type: "save", requestId: crypto.randomUUID() });
  }
  async validate() {
    await this.queue;
    await this.request({
      type: "validate",
      requestId: crypto.randomUUID(),
      external: false,
    });
  }
  async history(type: "undo" | "redo") {
    await this.queue;
    this.send({ type });
  }
  dispose() {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("Editor closed."));
    }
    this.pending.clear();
  }
}
