import type { ProxyFilters, ProxyRecord } from "./types.ts";

export function filterRecords(
  records: ProxyRecord[],
  filters: ProxyFilters,
): ProxyRecord[] {
  const search = normalize(filters.search);
  const provider = normalize(filters.provider);
  const statusClass = filters.statusClass === "all" ? "" : filters.statusClass;
  const modelFilter = normalize(filters.model);

  return records.filter((r) => {
    const recordProvider = normalize(r.provider ?? "unknown-provider");
    const recordModel = normalize(r.model ?? "unknown-model");

    const matchesProvider = provider ? recordProvider === provider : true;
    const matchesStatus = matchStatus(statusClass, r.status, r.upstreamStatus);
    const matchesModel = modelFilter ? recordModel === modelFilter : true;
    const matchesSearch = search
      ? `${r.method} ${r.path}`.toLowerCase().includes(search) ||
        recordModel.includes(search) ||
        recordProvider.includes(search)
      : true;

    return matchesProvider && matchesStatus && matchesModel && matchesSearch;
  });
}

function normalize(value: string | null | undefined): string {
  if (!value) return "";
  const lowered = value.trim().toLowerCase();
  if (lowered === "all") return "";
  return lowered;
}

function matchStatus(
  statusClass: string,
  status?: number,
  upstreamStatus?: number,
): boolean {
  if (!statusClass) return true;
  const code = status ?? upstreamStatus ?? 0;
  if (statusClass === "2xx") return code >= 200 && code < 300;
  if (statusClass === "4xx") return code >= 400 && code < 500;
  if (statusClass === "5xx") return code >= 500;
  return true;
}
