import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// /app/api/filter/route.ts atau lokasi file API Anda

export async function GET() {
  try {
    const [cities, categories, generalFilters] = await Promise.all([
      prisma.mst_cities.findMany({
        where: { status: 1 },
        select: { id: true, name: true }, // Ambil ID juga
        orderBy: { name: "asc" },
      }),
      prisma.mst_categories.findMany({
        where: { status: 1 },
        select: { id: true, name: true }, // Ambil ID juga
        orderBy: { name: "asc" },
      }),
      prisma.mst_general_filters.findMany({
        where: { status: 1 },
        select: { type: true, name: true },
      }),
    ]);

    const configuredSocialMedia = generalFilters
      .filter((item) => item.type === "socialMedia")
      .map((item) => item.name);
    const requiredSocialMedia = ["Instagram", "TikTok", "YouTube", "Twitter/X"];
    const socialMediaOptions = [...requiredSocialMedia, ...configuredSocialMedia]
      .filter((value, index, values) => values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);

    const tierOptions = generalFilters
      .filter((item) => item.type === "tier")
      .map((item) => item.name);

    const genderOptions = generalFilters
      .filter((item) => item.type === "gender")
      .map((item) => item.name);

    const dynamicFilters = [
      { id: "social_media", label: "Social Media", options: socialMediaOptions },
      { id: "tier", label: "Tier", options: tierOptions },
      // Modifikasi di sini: Kirim dalam bentuk array of object { id, name }
      { id: "category", label: "Category", options: categories.map((c) => ({ id: c.id.toString(), name: c.name })) },
      { id: "city", label: "City", options: cities.map((c) => ({ id: c.id.toString(), name: c.name })) },
      { id: "gender", label: "Gender", options: genderOptions },
    ];

    return NextResponse.json(dynamicFilters);
  } catch (error) {
    console.error("Failed to fetch filter data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { type, value } = await request.json();

    if (!value || value.trim() === "") {
      return NextResponse.json({ error: "Input cannot be empty" }, { status: 400 });
    }

    const cleanValue = value.trim();

    if (type === "city") {
      const existingCity = await prisma.mst_cities.findFirst({
        where: { name: { equals: cleanValue, mode: "insensitive" } },
      });

      if (existingCity) {
        return NextResponse.json({ error: `City "${cleanValue}" already exists in the database` }, { status: 400 });
      }

      const newCity = await prisma.mst_cities.create({
        data: { name: cleanValue, status: 1 },
      });
      return NextResponse.json({ success: true, data: newCity });

    } else if (type === "category") {
      const existingCategory = await prisma.mst_categories.findFirst({
        where: { name: { equals: cleanValue, mode: "insensitive" } },
      });

      if (existingCategory) {
        return NextResponse.json({ error: `Category "${cleanValue}" already exists in the database` }, { status: 400 });
      }

      const newCategory = await prisma.mst_categories.create({
        data: { name: cleanValue, status: 1 },
      });
      return NextResponse.json({ success: true, data: newCategory });
    }

    return NextResponse.json({ error: "Invalid filter type" }, { status: 400 });
  } catch (error) {
    console.error("Failed to add new filter:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
