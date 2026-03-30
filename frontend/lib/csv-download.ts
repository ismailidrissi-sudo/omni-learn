import { apiFetch } from "@/lib/api";

export async function downloadCsv(
  endpoint: string,
  filters: Record<string, string | undefined>,
  filenamePrefix: string,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }
  const queryString = params.toString();
  const url = `${endpoint}${queryString ? `?${queryString}` : ""}`;

  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Export failed");

  const blob = await res.blob();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `omnilearn-${filenamePrefix}-${date}.csv`;

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/** Download binary export (xlsx, pdf); uses Content-Disposition filename when present. */
export async function downloadBinaryExport(
  endpoint: string,
  filters: Record<string, string | undefined>,
  defaultFilename: string,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }
  const queryString = params.toString();
  const url = `${endpoint}${queryString ? `?${queryString}` : ""}`;

  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Export failed");

  const cd = res.headers.get("Content-Disposition");
  let filename = defaultFilename;
  const m = cd?.match(/filename="?([^";\n]+)"?/);
  if (m?.[1]) filename = m[1].trim();

  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
