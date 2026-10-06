/**
 * Memilih URL foto profil pertama yang valid dari hasil scraping.
 *
 * File ini tidak lagi mengunggah gambar ke Vercel Blob.
 * URL yang ditemukan akan diteruskan ke creator-processor.ts,
 * kemudian gambarnya diunduh dan disimpan sebagai binary di Neon.
 */
export function firstProfileImageUrl(
  sourceUrls: Array<string | null | undefined>
): string | null {
  for (const value of sourceUrls) {
    const candidate = String(value ?? "").trim();

    if (!candidate) continue;

    try {
      const url = new URL(candidate);

      if (url.protocol === "https:" || url.protocol === "http:") {
        return candidate;
      }
    } catch {
      // URL rusak diabaikan dan mencoba kandidat berikutnya.
    }
  }

  return null;
}