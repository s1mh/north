import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function verifyCronAuthorization(authorization: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  return timingSafeEqual(digest(supplied), digest(secret));
}
