import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { planning_upload, actual_upload, link_content, status } = body;

    const dataToUpdate: {
      drf_planning_upload?: Date;
      drf_actual_upload?: Date;
      drf_link_content?: string;
      drf_status?: number;
      modiby?: string;
      modidate?: Date;
    } = {
      modiby: session.user?.email ?? "SYSTEM",
      modidate: new Date(),
    };

    if (planning_upload) {
      dataToUpdate.drf_planning_upload = new Date(planning_upload);
    }
    if (actual_upload) {
      dataToUpdate.drf_actual_upload = new Date(actual_upload);
    }
    if (link_content !== undefined) {
      dataToUpdate.drf_link_content = link_content;
    }
    if (status !== undefined) {
      dataToUpdate.drf_status = status;
    }

    const updatedProjectDetail = await prisma.dtl_project.update({
      where: { drf_id: id },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedProjectDetail);
  } catch (error) {
    console.error("Error updating project detail:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
