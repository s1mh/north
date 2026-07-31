export function profileInitials(displayName: string | null | undefined) {
  const words = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) return "N";

  const first = Array.from(words[0] ?? "")[0] ?? "";
  const lastWord = words.length > 1 ? words[words.length - 1] : words[0];
  const last = words.length > 1
    ? Array.from(lastWord ?? "")[0] ?? ""
    : Array.from(words[0] ?? "")[1] ?? "";

  return `${first}${last}`.toLocaleUpperCase("pt-BR");
}
