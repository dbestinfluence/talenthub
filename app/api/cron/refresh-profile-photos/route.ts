import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Endpoint lama untuk memperbarui foto profil ke Vercel Blob.
 * Sekarang dinonaktifkan karena gambar disimpan sebagai binary di Neon.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      message:
        "Profile photo refresh endpoint is disabled. Images are now stored in Neon.",
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      message:
        "Profile photo refresh endpoint is disabled. Images are now stored in Neon.",
    },
    { status: 410 }
  );
}