/** Resolve local uploads through the same API endpoint as the dashboard. */
export function resolveFileUrl(
  path: string | null | undefined,
  apiBaseUrl: string,
): string | null {
  if (!path?.trim()) return null;

  const base = apiBaseUrl.replace(/\/+$/, "");
  const apiPath = new URL(base, "http://api-base.invalid").pathname.replace(/\/+$/, "");
  const uploadPrefix = `${apiPath}/files/`;
  const cleanPath = path.trim().replace(/\\/g, "/");

  if (/^https?:\/\//i.test(cleanPath) || cleanPath.startsWith("//")) {
    try {
      const url = new URL(cleanPath, "http://api-base.invalid");
      // Signed cloud URLs must keep their host and signature unchanged.
      if (url.searchParams.has("X-Amz-Signature")) return cleanPath;
      if (url.pathname.startsWith(uploadPrefix)) {
        return `${base}${url.pathname.slice(apiPath.length)}${url.search}${url.hash}`;
      }
      return cleanPath;
    } catch {
      return null;
    }
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(cleanPath)) return null;
  const rootedPath = `/${cleanPath.replace(/^\/+/, "")}`;
  if (rootedPath.startsWith(uploadPrefix)) {
    return `${base}${rootedPath.slice(apiPath.length)}`;
  }
  return `${base}/${cleanPath.replace(/^\/+/, "")}`;
}
