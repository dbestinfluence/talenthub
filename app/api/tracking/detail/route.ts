import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { isSowForPlatform } from "@/lib/social-platform";
import { calculateTaxSummary } from "@/lib/tax";
import { getContentIdentity } from "@/lib/content-url";
import { calculateProjectSubtotal } from "@/lib/project-pricing";

async function authorize() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return session;
}

// ================= GET =================
export async function GET(request: Request) {
  const session = await authorize();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);

    const projectId = Number(searchParams.get("projectId"));

    if (isNaN(projectId)) {
      return NextResponse.json(
        {
          error: "Invalid Project ID",
        },
        { status: 400 }
      );
    }

    const details = await prisma.dtl_project.findMany({
      where: {
        drf_projectid: projectId,
      },
      include: {
        mst_creators: true,
        mst_sow: true,
        detail_report: { select: { id: true } },
      },
      orderBy: [
        { drf_sort_order: "asc" },
        { drf_id: "asc" },
      ],
    });

    type ProjectDetail = (typeof details)[number];

    const subtotal = calculateProjectSubtotal(details);

    const project = await prisma.trs_project.findUnique({ where: { prj_id: projectId } });
    const taxRate = Number(project?.prj_tax_rate ?? 11);
    const { dpp, ppn, grandTotal } = calculateTaxSummary(subtotal, taxRate);

    return NextResponse.json({
      creators: details.map((item: ProjectDetail, index: number) => {
        const isBundle = item.drf_pricing_type === "BUNDLE" && Boolean(item.drf_bundle_id);
        const isBundleLead = isBundle && details.findIndex(
          (detail) => detail.drf_bundle_id === item.drf_bundle_id
        ) === index;
        const effectivePrice = isBundle
          ? Number(item.drf_bundle_price ?? 0)
          : Number(item.drf_markup_price ?? 0);
        const total = isBundle
          ? (isBundleLead ? effectivePrice : 0)
          : effectivePrice * Number(item.drf_qty);

        return ({
        ...item, // pass all original fields
        id: item.drf_id,

        creatorId: item.drf_creatorid,
        name: item.mst_creators.name,
        username: item.mst_creators.username,
        photo: item.mst_creators.photo_url,

        platform: item.drf_platform ?? item.mst_creators.social_media,
        tier: item.mst_creators.tier,
        gender: item.mst_creators.gender,

        followers: item.mst_creators.followers,
        totalPost: item.mst_creators.total_post,

        engagementRate: Number(item.mst_creators.engagement_rate),
        erFollowers: Number(item.mst_creators.er_followers ?? 0),
        erViews: Number(item.mst_creators.er_views ?? 0),
        erTalenthub: Number(item.mst_creators.er_talenthub ?? 0),
        avgLikes: item.mst_creators.avg_likes,
        avgComments: item.mst_creators.avg_comments,

        averageView: item.mst_creators.average_view,
        averageViewBrand: item.mst_creators.average_view_brand,

        cpvAll: item.mst_creators.average_view ? effectivePrice / item.mst_creators.average_view : 0,
        cpvBranded: item.mst_creators.average_view_brand ? effectivePrice / item.mst_creators.average_view_brand : 0,

        sowId: item.drf_sow,
        sow: item.mst_sow?.sow_nama,

        qty: item.drf_qty,
        rateCard: item.drf_rate === null ? null : Number(item.drf_rate),
        markupPrice: item.drf_markup_price === null ? null : Number(item.drf_markup_price),
        pricingType: item.drf_pricing_type,
        bundleId: item.drf_bundle_id,
        bundlePrice: item.drf_bundle_price === null ? null : Number(item.drf_bundle_price),
        isBundleLead,
        rate: Number(item.drf_markup_price ?? 0),

        total,
        hasReport: Boolean(item.detail_report),
      });
      }),

      subtotal,
      dpp,
      ppn,
      grandTotal,
      taxRate,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to fetch project details",
      },
      { status: 500 }
    );
  }
}

// ================= PATCH for detail project =================
export async function PATCH(req: Request) {
  const session = await authorize();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (isNaN(id)) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const body = await req.json();

    if (body.pricingType !== undefined) {
      const pricingType = String(body.pricingType).trim().toUpperCase();
      if (!['NORMAL', 'BUNDLE'].includes(pricingType)) {
        return NextResponse.json({ error: "Pricing Type must be Normal or Bundle" }, { status: 400 });
      }
      const detail = await prisma.dtl_project.findUnique({
        where: { drf_id: id },
        select: {
          drf_bundle_id: true,
          trs_project: { select: { prj_status: true } },
        },
      });
      if (!detail) return NextResponse.json({ error: "Creator detail was not found" }, { status: 404 });
      if (detail.trs_project.prj_status !== 1) {
        return NextResponse.json({ error: "Pricing Type can only be changed while the project is in Draft" }, { status: 409 });
      }

      if (pricingType === 'BUNDLE') {
        const bundleId = detail.drf_bundle_id ?? `bundle-${id}-${Date.now()}`;
        await prisma.dtl_project.update({
          where: { drf_id: id },
          data: {
            drf_pricing_type: 'BUNDLE',
            drf_bundle_id: bundleId,
            drf_bundle_price: null,
            modiby: session.user.name ?? "admin",
            modidate: new Date(),
          },
        });
      } else if (detail.drf_bundle_id) {
        await prisma.dtl_project.updateMany({
          where: { drf_bundle_id: detail.drf_bundle_id },
          data: {
            drf_pricing_type: 'NORMAL',
            drf_bundle_id: null,
            drf_bundle_price: null,
            modiby: session.user.name ?? "admin",
            modidate: new Date(),
          },
        });
      } else {
        await prisma.dtl_project.update({
          where: { drf_id: id },
          data: { drf_pricing_type: 'NORMAL', modiby: session.user.name ?? "admin", modidate: new Date() },
        });
      }
      return NextResponse.json({ success: true });
    }

    if (body.drf_bundle_price !== undefined) {
      const bundlePrice = body.drf_bundle_price === null || body.drf_bundle_price === ""
        ? null
        : Number(body.drf_bundle_price);
      if (bundlePrice !== null && (!Number.isFinite(bundlePrice) || bundlePrice <= 0)) {
        return NextResponse.json({ error: "Bundle Price is required and must be greater than 0" }, { status: 400 });
      }
      const detail = await prisma.dtl_project.findUnique({
        where: { drf_id: id },
        select: { drf_pricing_type: true, drf_bundle_id: true, trs_project: { select: { prj_status: true } } },
      });
      if (!detail?.drf_bundle_id || detail.drf_pricing_type !== 'BUNDLE') {
        return NextResponse.json({ error: "This row is not part of a bundle" }, { status: 400 });
      }
      if (detail.trs_project.prj_status !== 1) {
        return NextResponse.json({ error: "Bundle Price can only be changed while the project is in Draft" }, { status: 409 });
      }
      await prisma.dtl_project.updateMany({
        where: { drf_bundle_id: detail.drf_bundle_id },
        data: { drf_bundle_price: bundlePrice, modiby: session.user.name ?? "admin", modidate: new Date() },
      });
      return NextResponse.json({ success: true, bundlePrice });
    }

    if (body.platform !== undefined) {
      const platform = String(body.platform).trim().toLowerCase();
      if (!['instagram', 'youtube', 'tiktok'].includes(platform)) {
        return NextResponse.json({ error: "Platform must be Instagram, YouTube, or TikTok" }, { status: 400 });
      }
      const detail = await prisma.dtl_project.findUnique({
        where: { drf_id: id },
        select: { drf_creatorid: true, trs_project: { select: { prj_status: true } } },
      });
      if (!detail) return NextResponse.json({ error: "Creator detail was not found" }, { status: 404 });
      if (detail.trs_project.prj_status !== 1) {
        return NextResponse.json({ error: "Platform can only be changed while the project is in Draft" }, { status: 400 });
      }
      await prisma.dtl_project.update({
        where: { drf_id: id },
        data: {
          drf_platform: platform,
          drf_sow: null,
          modiby: session.user.name ?? "admin",
          modidate: new Date(),
        },
      });
      return NextResponse.json({ success: true, platform });
    }

    if (body.drf_sow !== undefined && body.drf_sow !== null) {
      const sowId = Number(body.drf_sow);

      if (!Number.isInteger(sowId)) {
        return NextResponse.json({ error: "Invalid SOW" }, { status: 400 });
      }

      const sow = await prisma.mst_sow.findUnique({
        where: { sow_id: sowId },
      });

      if (!sow) {
        return NextResponse.json({ error: "SOW was not found" }, { status: 404 });
      }

      const detail = await prisma.dtl_project.findUnique({
        where: { drf_id: id },
        select: { drf_platform: true, mst_creators: { select: { social_media: true } } },
      });
      if (!detail) return NextResponse.json({ error: "Creator detail was not found" }, { status: 404 });
      const detailPlatform = detail.drf_platform ?? detail.mst_creators.social_media;
      if (!isSowForPlatform(sow.sow_nama, detailPlatform)) {
        return NextResponse.json({ error: `The selected SOW does not match the creator platform (${detailPlatform})` }, { status: 400 });
      }
    }

    const dataToUpdate: {
      drf_sow?: number | null;
      drf_planning_upload?: Date | null;
      drf_actual_upload?: Date | null;
      drf_link_content?: string | null;
      drf_rate?: number | null;
      drf_markup_price?: number | null;
      drf_qty?: number | null;
      modiby: string;
      modidate: Date;
    } = {
      modiby: session.user.name ?? "admin",
      modidate: new Date(),
    };

    if (body.drf_planning_upload !== undefined || body.drf_actual_upload !== undefined) {
      const validateUploadDate = (value: unknown, label: string) => {
        if (value === undefined || value === null || value === "") return null;
        const uploadDate = new Date(String(value));
        if (Number.isNaN(uploadDate.getTime())) return `${label} is not a valid date`;
        return null;
      };

      const dateError = validateUploadDate(body.drf_planning_upload, "Planning Upload")
        ?? validateUploadDate(body.drf_actual_upload, "Actual Upload");
      if (dateError) {
        return NextResponse.json({ error: dateError }, { status: 400 });
      }
    }

    if (body.drf_sow !== undefined) {
      dataToUpdate.drf_sow = body.drf_sow === null || body.drf_sow === ""
        ? null
        : Number(body.drf_sow);
    }

    if (body.drf_planning_upload !== undefined) {
      dataToUpdate.drf_planning_upload = body.drf_planning_upload
        ? new Date(body.drf_planning_upload)
        : null;
    }

    if (body.drf_actual_upload !== undefined) {
      dataToUpdate.drf_actual_upload = body.drf_actual_upload
        ? new Date(body.drf_actual_upload)
        : null;
    }

    if (body.drf_link_content !== undefined) {
      const linkContent = String(body.drf_link_content ?? "").trim();
      if (!linkContent) {
        dataToUpdate.drf_link_content = null;
      } else {
        const detail = await prisma.dtl_project.findUnique({
          where: { drf_id: id },
          include: { mst_creators: { select: { social_media: true } } },
        });
        if (!detail) return NextResponse.json({ error: "Creator detail was not found" }, { status: 404 });

        let identity;
        try {
          identity = getContentIdentity(linkContent, detail.drf_platform ?? detail.mst_creators.social_media);
        } catch (error) {
          return NextResponse.json(
            { error: error instanceof Error ? error.message : "Invalid content URL" },
            { status: 400 },
          );
        }
        dataToUpdate.drf_link_content = identity.normalizedUrl;
      }
    }

    if (body.drf_rate !== undefined) {
      if (body.drf_rate === null || body.drf_rate === "") {
        dataToUpdate.drf_rate = null;
      } else {
        const rateCard = Number(body.drf_rate);
        if (!Number.isFinite(rateCard) || rateCard <= 0) {
          return NextResponse.json(
            { error: "Rate Card is required and must be greater than 0" },
            { status: 400 }
          );
        }
        dataToUpdate.drf_rate = rateCard;
      }
    }

    if (body.drf_markup_price !== undefined) {
      if (body.drf_markup_price === null || body.drf_markup_price === "") {
        dataToUpdate.drf_markup_price = null;
      } else {
        const markupPrice = Number(body.drf_markup_price);
        if (!Number.isFinite(markupPrice) || markupPrice <= 0) {
          return NextResponse.json(
            { error: "Mark Price is required and must be greater than 0" },
            { status: 400 }
          );
        }
        dataToUpdate.drf_markup_price = markupPrice;
      }
    }

    if (body.drf_qty !== undefined) {
      if (body.drf_qty === null || body.drf_qty === "") {
        dataToUpdate.drf_qty = null;
      } else {
        const quantity = Number(body.drf_qty);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          return NextResponse.json(
            { error: "Qty must be a whole number greater than 0" },
            { status: 400 }
          );
        }
        dataToUpdate.drf_qty = quantity;
      }
    }

    const updatedCreator = await prisma.dtl_project.update({
      where: { drf_id: id },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedCreator);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// ================= POST duplicate creator row for another SOW =================
export async function POST(req: Request) {
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const sourceDetailId = Number(body.sourceDetailId);
    if (!Number.isInteger(sourceDetailId) || sourceDetailId <= 0) {
      return NextResponse.json({ error: "Invalid creator detail" }, { status: 400 });
    }

    const source = await prisma.dtl_project.findUnique({ where: { drf_id: sourceDetailId } });
    if (!source) return NextResponse.json({ error: "Creator detail was not found" }, { status: 404 });

    const project = await prisma.trs_project.findUnique({
      where: { prj_id: source.drf_projectid },
      select: { prj_status: true },
    });
    if (project?.prj_status !== 1) {
      return NextResponse.json({ error: "SOW rows can only be added while the project is Draft" }, { status: 409 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const sourceOrder = source.drf_sort_order;
      await tx.dtl_project.updateMany({
        where: {
          drf_projectid: source.drf_projectid,
          drf_sort_order: { gt: sourceOrder },
        },
        data: { drf_sort_order: { increment: 1 } },
      });

      return tx.dtl_project.create({
        data: {
          drf_projectid: source.drf_projectid,
          drf_creatorid: source.drf_creatorid,
          drf_platform: source.drf_platform,
          drf_sort_order: sourceOrder + 1,
          drf_sow: null,
          drf_qty: null,
          drf_rate: source.drf_rate,
          drf_markup_price: source.drf_markup_price,
          drf_pricing_type: source.drf_pricing_type,
          drf_bundle_id: source.drf_bundle_id,
          drf_bundle_price: source.drf_bundle_price,
          drf_status: 0,
          creaby: session.user.name ?? "admin",
          creadate: new Date(),
          modiby: session.user.name ?? "admin",
          modidate: new Date(),
        },
      });
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("ADD SOW ROW ERROR:", error);
    return NextResponse.json({ error: "Failed to add SOW row" }, { status: 500 });
  }
}

// ================= DELETE =================
export async function DELETE(req: Request) {
  const session = await authorize();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);

    const id = Number(searchParams.get("id"));

    if (isNaN(id)) {
      return NextResponse.json(
        {
          error: "Invalid ID",
        },
        { status: 400 }
      );
    }

    const detail = await prisma.dtl_project.findUnique({
      where: { drf_id: id },
      select: { trs_project: { select: { prj_status: true } } },
    });
    if (!detail) return NextResponse.json({ error: "Creator detail was not found" }, { status: 404 });
    if (detail.trs_project.prj_status !== 1) {
      return NextResponse.json({ error: "Creators can only be removed while the project is Draft" }, { status: 409 });
    }

    await prisma.dtl_project.delete({
      where: {
        drf_id: id,
      },
    });

    return NextResponse.json({
      message: "Creator has been successfully removed from the project",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to delete creator",
      },
      { status: 500 }
    );
  }
}

// POST and PUT handlers from your provided code can be added here if needed.
// For this specific task, they are not directly involved in the error.
