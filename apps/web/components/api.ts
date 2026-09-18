export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method,
    headers:
      data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json();
    const details = Array.isArray(body.error?.details)
      ? body.error.details
          .filter((p: { message?: unknown }) => typeof p?.message === "string")
          .map(
            (p: { line?: number; column?: number; message: string }) =>
              `${p.line ? `Line ${p.line}:${p.column ?? 1}: ` : ""}${p.message}`,
          )
          .join("\n")
      : "";
    throw new Error(
      [body.error?.message ?? "Request failed.", details]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/yaml" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = /\.ya?ml$/.test(name) ? name : `${name}.yml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
