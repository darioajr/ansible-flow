import { ZodError } from "zod";
import { AppError } from "./store";
export function errorResponse(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "Invalid request data.",
          details: error.issues,
        },
      },
      { status: 400 },
    );
  if (error instanceof AppError)
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  console.error(JSON.stringify({ level: "error", event: "request.failed" }));
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
        details: [],
      },
    },
    { status: 500 },
  );
}
export async function body(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new AppError(
      403,
      "ORIGIN_REJECTED",
      "Cross-origin writes are not allowed.",
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "INVALID_JSON", "A body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1_000_000) {
      await reader.cancel();
      throw new AppError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Maximum request size is 1 MB.",
      );
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError(400, "INVALID_JSON", "Invalid JSON body.");
  }
}
