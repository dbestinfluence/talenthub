import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { drf_planning_upload, drf_actual_upload, drf_link_content } = body;

    const updatedDetail = await prisma.dtl_project.update({
      where: {
        drf_id: parseInt(id),
      },
      data: {
        drf_planning_upload: drf_planning_upload ? new Date(drf_planning_upload) : null,
        drf_actual_upload: drf_actual_upload ? new Date(drf_actual_upload) : null,
        drf_link_content,
        modidate: new Date(),
      },
    });

    return NextResponse.json(updatedDetail, { status: 200 });
  } catch (error) {
    console.error("Error updating tracking detail:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
