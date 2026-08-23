import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const getTierFollowersRange = (tier: string) => {
  const tierLower = tier.toLowerCase();
  if (tierLower.startsWith("nano")) return { gte: 1000, lt: 10000 };
  if (tierLower.startsWith("micro")) return { gte: 10000, lt: 100000 };
  if (tierLower.startsWith("macro")) return { gte: 100000, lt: 1000000 };
  if (tierLower.startsWith("mega")) return { gte: 1000000 };
  return null;
};

// Format angka besar jadi "18.0K" / "1.2M", sama seperti followers/avrView.
function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

// er_followers/er_views/er_talenthub bertipe Prisma.Decimal — harus
// di-convert lewat Number() dulu sebelum dipakai (Decimal bukan number biasa,
// kalau langsung ditempel ke string bisa jadi object/format aneh).
function formatPercent(value: unknown): string {
  const num = Number(value ?? 0);
  return `${Number.isFinite(num) ? num.toFixed(2) : "0.00"}%`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const social_media = searchParams.get("social_media");
  const tier = searchParams.get("tier");
  const gender = searchParams.get("gender");
  const category = searchParams.get("category"); // Bisa berupa ID atau Nama dari UI
  const city = searchParams.get("city"); // Bisa berupa ID atau Nama dari UI

  const where: any = {};

  if (social_media)
    where.social_media = { equals: social_media, mode: "insensitive" };
  if (gender) where.gender = { equals: gender, mode: "insensitive" };

  // Filter berdasarkan ID atau Nama Kategori
  if (category) {
    if (!isNaN(Number(category))) {
      where.category_id = Number(category);
    } else {
      where.mst_categories = {
        name: { equals: category, mode: "insensitive" },
      };
    }
  }

  // Filter berdasarkan ID atau Nama Kota
  if (city) {
    if (!isNaN(Number(city))) {
      where.city_id = Number(city);
    } else {
      where.mst_cities = { name: { equals: city, mode: "insensitive" } };
    }
  }

  if (tier) {
    const range = getTierFollowersRange(tier);
    if (range) where.followers = range;
  }

  // Ambil data berikut relasinya
  const creators = await prisma.mst_creators.findMany({
    where,
    include: {
      mst_categories: true,
      mst_cities: true,
    },
  });

  const formattedData = creators.map((c) => {
    const followersCount = c.followers ?? 0;
    const totalPost = c.total_post ?? 0;
    const avgView = c.average_view ?? 0;
    const avgLikes = c.avg_likes ?? 0;
    const avgComments = c.avg_comments ?? 0;

    return {
      id: c.id, // <-- tambahan: ID database asli, eksplisit
      no: c.id, // tetap dipertahankan karena dipakai untuk selectedRows di FE
      name: c.name || "Unknown",
      username: c.username || "-",
      photo_url: c.photo_url || null,
      post: totalPost.toLocaleString(),
      // "er" lama (engagement_rate) DIHAPUS — diganti 3 field ER baru di bawah.
      erFollowers: formatPercent(c.er_followers),
      erViews: formatPercent(c.er_views),
      erTalenthub: formatPercent(c.er_talenthub),
      avgLikes: formatCompactNumber(avgLikes),
      avgComments: formatCompactNumber(avgComments),
      followers:
        followersCount >= 1000000
          ? `${(followersCount / 1000000).toFixed(1)}M`
          : followersCount >= 1000
          ? `${(followersCount / 1000).toFixed(0)}K`
          : followersCount.toString(),
      avrView:
        avgView >= 1000000
          ? `${(avgView / 1000000).toFixed(1)}M`
          : avgView >= 1000
          ? `${(avgView / 1000).toFixed(0)}K`
          : avgView.toString(),
      social_media: c.social_media,
      tier: c.tier,
      gender: c.gender,
      city_id: c.city_id,
      category_id: c.category_id,
      cityName: c.mst_cities?.name || "",
      categoryName: c.mst_categories?.name || "",
      followersRaw: followersCount,
    };
  });

  return NextResponse.json(formattedData);
}