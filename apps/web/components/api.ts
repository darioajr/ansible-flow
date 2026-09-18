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
    throw new Error(body.error?.message ?? "Request failed.");
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
