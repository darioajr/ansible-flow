import * as store from "@/server/store";
import * as service from "@/server/service";
import { body, errorResponse } from "@/server/http";
import { modules } from "@visual-ansible/module-metadata";
import { validatePlaybook } from "@visual-ansible/validator";
import { playbookSchema } from "@visual-ansible/schemas";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, ctx: Context) {
  try {
    const parts = (await ctx.params).path;
    const [resource, id, action] = parts;
    const method = request.method;
    if (parts.length > 3)
      throw new store.AppError(404, "NOT_FOUND", "Endpoint not found.");
    if (resource === "modules" && !action && method === "GET") {
      const result = id ? modules.find((m) => m.fqcn === id) : modules;
      if (!result)
        throw new store.AppError(404, "NOT_FOUND", "Module not found.");
      return Response.json(result);
    }
    if (resource === "projects") {
      if (!id && method === "GET")
        return Response.json(
          (await store.list()).map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            updatedAt: p.updatedAt,
            playbooks: p.playbooks.length,
          })),
        );
      if (!id && method === "POST")
        return Response.json(await service.create(await body(request)), {
          status: 201,
        });
      if (id && action === "playbooks" && method === "GET")
        return Response.json((await store.load(id)).playbooks);
      if (id && action === "playbooks" && method === "POST")
        return Response.json(await service.addBook(id, await body(request)), {
          status: 201,
        });
      if (id && !action && method === "GET")
        return Response.json(await store.load(id));
      if (id && !action && method === "PUT")
        return Response.json(await service.update(id, await body(request)));
      if (id && !action && method === "DELETE") {
        await body(request);
        await store.remove(id);
        return new Response(null, { status: 204 });
      }
    }
    if (
      resource === "playbooks" &&
      id === "import" &&
      !action &&
      method === "POST"
    )
      return Response.json(service.importBook(await body(request)));
    if (
      resource === "playbooks" &&
      id &&
      method === "POST" &&
      ["generate", "validate"].includes(action)
    ) {
      const data = await body(request);
      const book = data?.playbook
        ? playbookSchema.parse(data.playbook)
        : await service.findBook(id);
      if (book.id !== id)
        throw new store.AppError(
          400,
          "ID_MISMATCH",
          "Playbook ID does not match URL.",
        );
      return Response.json(
        action === "generate"
          ? service.generate(book)
          : {
              problems: validatePlaybook(book),
              checks: ["AIR", "bundled metadata"],
              unavailable: ["ansible-playbook --syntax-check", "ansible-lint"],
            },
      );
    }
    throw new store.AppError(404, "NOT_FOUND", "Endpoint not found.");
  } catch (e) {
    return errorResponse(e);
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
