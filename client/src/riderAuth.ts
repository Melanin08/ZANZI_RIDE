export type User = { id: string; name: string; email: string };
export async function authRequest(path: string, body?: object) {
  const response = await fetch(`/api/auth/${path}`, { method: body ? "POST" : "GET", credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Please try again.");
  return data;
}
