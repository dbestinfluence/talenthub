import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idParam } = await params;
  const projectId = Number(idParam);
  if (!Number.isInteger(projectId)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });

  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  if (!smtpUser || !smtpPassword) return NextResponse.json({ error: "SMTP configuration is not available on the server" }, { status: 500 });

  try {
    const project = await prisma.trs_project.findUnique({ where: { prj_id: projectId }, include: { mst_brand: true } });
    if (!project) return NextResponse.json({ error: "Project was not found" }, { status: 404 });
    const recipientEmail = project.mst_brand?.brd_email?.trim();
    if (!recipientEmail) return NextResponse.json({ error: "The brand email address is missing" }, { status: 400 });

    const formData = await request.formData();
    const invoice = formData.get("invoice");
    if (!(invoice instanceof File) || invoice.size === 0) return NextResponse.json({ error: "The invoice PDF file is required" }, { status: 400 });

    const brandName = escapeHtml(project.mst_brand?.brd_nama ?? "Partner");
    const projectName = escapeHtml(project.prj_nama);
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST ?? "smtp.gmail.com", port: Number(process.env.SMTP_PORT ?? 465), secure: (process.env.SMTP_SECURE ?? "true") === "true", auth: { user: smtpUser, pass: smtpPassword } });
    await transporter.sendMail({
      from: `D'BEST Influence <${smtpUser}>`, to: recipientEmail, subject: `Invoice ${project.prj_invoiceno ?? "-"} – ${project.prj_nama}`,
      text: `Dear ${project.mst_brand?.brd_nama ?? "Brand"} Team,\n\nPlease find the invoice attached for project ${project.prj_nama} (${project.prj_kode}).\n\nBest regards,\nD'BEST Influence`,
      html: `<div style="margin:0;padding:32px 16px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937"><div style="max-width:620px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(15,23,42,.08)"><div style="padding:28px 36px;background:#111827;color:#fff"><div style="font-size:12px;letter-spacing:2px;font-weight:700;color:#d6b18a">D'BEST INFLUENCE</div><div style="margin-top:10px;font-size:25px;font-weight:700">Invoice for Your Reference</div></div><div style="padding:32px 36px;font-size:15px;line-height:1.65"><p style="margin-top:0">Dear <strong>${brandName}</strong> Team,</p><p>Please find the invoice for your project attached to this email.</p><table style="width:100%;border-collapse:collapse;margin:24px 0;background:#f9fafb"><tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280">Project</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:700">${projectName}</td></tr><tr><td style="padding:12px 16px;color:#6b7280">Project Code</td><td style="padding:12px 16px;font-weight:700">${escapeHtml(project.prj_kode)}</td></tr></table><p>Please review the attached invoice. We are happy to help with any questions.</p><p style="margin-bottom:0">Best regards,<br><strong>D'BEST Influence</strong></p></div><div style="padding:18px 36px;background:#f9fafb;color:#6b7280;font-size:12px;text-align:center">This email was sent automatically through TalentHub.</div></div></div>`,
      attachments: [{ filename: invoice.name || `Invoice_${project.prj_invoiceno ?? project.prj_id}.pdf`, content: Buffer.from(await invoice.arrayBuffer()), contentType: "application/pdf" }],
    });
    return NextResponse.json({ success: true, email: recipientEmail });
  } catch (error) {
    console.error("SEND INVOICE EMAIL ERROR:", error);
    return NextResponse.json({ error: "Failed to send invoice email" }, { status: 500 });
  }
}
