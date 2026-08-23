const MAX_PROFILE_IMAGE_BYTES = 1_500_000;

export function firstProfileImageUrl(
  sourceUrls: Array<string | null | undefined>,
): string | null {
  for (const value of sourceUrls) {
    const candidate = String(value ?? "").trim();
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") return candidate;
    } catch {
      // Ignore malformed scraper output and try the next candidate.
    }
  }
  return null;
}

export async function persistProfileImage(sourceUrl?: string | null): Promise<string | null> {
  const url = String(sourceUrl ?? "").trim();
  if (!url) return null;
  if (url.startsWith("data:image/") || url.startsWith("/")) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: parsed.hostname.includes("tiktok")
          ? "https://www.tiktok.com/"
          : "https://www.instagram.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      },
    });
    if (!response.ok) return url;

    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!contentType?.startsWith("image/")) return url;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_PROFILE_IMAGE_BYTES) return url;
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return url;
  }
}

export async function persistFirstProfileImage(
  sourceUrls: Array<string | null | undefined>,
): Promise<string | null> {
  const candidates = [...new Set(sourceUrls.map((value) => String(value ?? "").trim()).filter(Boolean))];

  for (const candidate of candidates) {
    const persisted = await persistProfileImage(candidate);
    if (persisted?.startsWith("data:image/")) return persisted;
  }

  // Keep the best database URL as a browser-side fallback. The UI will first
  // try the authenticated proxy and then this original URL directly.
  return candidates[0] ?? null;
}
