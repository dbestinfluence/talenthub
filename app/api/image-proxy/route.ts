import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Validate the parsed hostname instead of matching arbitrary URL text.
  const allowedHosts = [
    "cdninstagram.com",
    "fbcdn.net",
    "instagram.com",
    "tiktokcdn.com",
    "tiktokcdn-us.com",
    "tiktokcdn-eu.com",
    "ibyteimg.com",
    "byteimg.com",
    "muscdn.com",
    "akamaized.net",
  ];
  let hostname: string;
  try {
    const parsed = new URL(imageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }
  const isAllowed = allowedHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
  if (!isAllowed) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(imageUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: imageUrl.includes("tiktok")
          ? "https://www.tiktok.com/"
          : "https://www.instagram.com/",
      },
    });

    if (!res.ok) {
      return NextResponse.redirect(new URL("/image/default-kol-avatar.png", request.url));
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.redirect(new URL("/image/default-kol-avatar.png", request.url));
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return NextResponse.redirect(new URL("/image/default-kol-avatar.png", request.url));
  }
}
