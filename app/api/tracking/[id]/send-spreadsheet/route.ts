import { authOptions } from '@/auth';
import { syncProjectSpreadsheet } from '@/lib/google-sheets';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });

  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  if (!smtpUser || !smtpPassword) {
    return NextResponse.json({ error: 'SMTP configuration is not available on the server' }, { status: 500 });
  }

  try {
    const project = await prisma.trs_project.findUnique({ where: { prj_id: projectId }, include: { mst_brand: true } });
    if (!project) return NextResponse.json({ error: 'Project was not found' }, { status: 404 });
    const recipientEmail = project.mst_brand.brd_email?.trim();
    if (!recipientEmail) return NextResponse.json({ error: 'The brand email address is missing' }, { status: 400 });

    const sheet = await syncProjectSpreadsheet(projectId, true);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
      auth: { user: smtpUser, pass: smtpPassword },
    });
    const brandName = escapeHtml(project.mst_brand.brd_nama ?? 'Partner');
    const projectName = escapeHtml(project.prj_nama);
    const projectCode = escapeHtml(project.prj_kode);
    const spreadsheetUrl = escapeHtml(sheet.spreadsheetUrl);

    await transporter.sendMail({
      from: `D'BEST Influence <${smtpUser}>`,
      to: recipientEmail,
      subject: `Google Spreadsheet ${project.prj_kode} - ${project.prj_nama}`,
      text: `Dear ${project.mst_brand.brd_nama ?? 'Brand'} Team,\n\nThe creator spreadsheet for ${project.prj_nama} is available here:\n${sheet.spreadsheetUrl}\n\nBest regards,\nD'BEST Influence`,
      html: `<div style="margin:0;padding:32px 16px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937"><div style="max-width:620px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(15,23,42,.08)"><div style="padding:28px 36px;background:#111827;color:#fff"><div style="font-size:12px;letter-spacing:2px;font-weight:700;color:#d6b18a">D'BEST INFLUENCE</div><div style="margin-top:10px;font-size:25px;font-weight:700">Creator Google Spreadsheet</div></div><div style="padding:32px 36px;font-size:15px;line-height:1.65"><p style="margin-top:0">Dear <strong>${brandName}</strong> Team,</p><p>The creator spreadsheet has been created and shared with this email address.</p><table style="width:100%;border-collapse:collapse;margin:24px 0;background:#f9fafb"><tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280">Project</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:700">${projectName}</td></tr><tr><td style="padding:12px 16px;color:#6b7280">Project Code</td><td style="padding:12px 16px;font-weight:700">${projectCode}</td></tr></table><div style="margin:28px 0;text-align:center"><a href="${spreadsheetUrl}" style="display:inline-block;padding:13px 24px;border-radius:9px;background:#16a34a;color:#fff;text-decoration:none;font-weight:700">Open Google Spreadsheet</a></div><p>You can review and edit the creator list directly through the link above.</p><p style="margin-bottom:0">Best regards,<br><strong>D'BEST Influence</strong></p></div><div style="padding:18px 36px;background:#f9fafb;color:#6b7280;font-size:12px;text-align:center">This email was sent automatically through TalentHub.</div></div></div>`,
    });
    return NextResponse.json({ success: true, email: recipientEmail, spreadsheetUrl: sheet.spreadsheetUrl });
  } catch (error) {
    console.error('SEND GOOGLE SPREADSHEET ERROR:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to send Google Spreadsheet' }, { status: 500 });
  }
}
