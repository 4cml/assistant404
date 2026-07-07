export function withBase(relativePath) {
  const base = import.meta.env.BASE_URL;

  const cleanBase = base.endsWith("/")
    ? base.slice(0, -1)
    : base;

  const cleanPath = relativePath.startsWith("/")
    ? relativePath.slice(1)
    : relativePath;

  return `${cleanBase}/${cleanPath}`;
}