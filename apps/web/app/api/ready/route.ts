import { ready } from "@/server/store";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await ready();
    return Response.json({ status: "ready" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
