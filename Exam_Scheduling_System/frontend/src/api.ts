import axios from "axios";

function resolveApiBase() {
  const raw =
    (import.meta.env.VITE_API_BASE as string | undefined) ??
    "http://localhost:3001";

  // If someone set a Docker-only hostname (backend), fix it for browser usage.
  if (typeof window !== "undefined" && raw.includes("://backend:")) {
    return raw.replace("://backend:", `://${window.location.hostname}:`);
  }

  return raw;
}

export const API_BASE = resolveApiBase();

export const api = axios.create({
  baseURL: API_BASE,
});

export async function downloadBlob(url: string, filename: string) {
  const res = await api.get(url, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

