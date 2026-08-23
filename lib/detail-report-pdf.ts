import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { normalizePlatform, SOCIAL_PLATFORMS } from './social-platform';
import { loadCompanyLogo } from './pdf-branding';

type StoredReport = {
  caption: string | null;
  thumbnail_url: string | null;
  likes: number;
  comments: number;
  saves: number;
  reposts: number;
  views: number;
  plays: number;
  duration: number;
  shares: number;
  performance: number;
};

type ReportItem = {
  detailId: number;
  creatorName: string;
  username: string;
  platform: string;
  followers: number;
  sow: string | null;
  contentUrl: string | null;
  report: StoredReport | null;
};

export type DetailReportPayload = {
  project: { id: number; code: string; brand: string | null; name: string; pic: string; date: string | null; dbest?: { name: string; address: string } | null };
  items: ReportItem[];
};

const NAVY: [number, number, number] = [25, 49, 61];
const GREEN: [number, number, number] = [73, 132, 108];
const MINT: [number, number, number] = [174, 211, 197];
const PINK: [number, number, number] = [235, 177, 180];
const ORANGE: [number, number, number] = [214, 143, 72];
const PAPER: [number, number, number] = [252, 252, 250];
const DEFAULT_THUMBNAIL = '/image/default-kol-avatar.png';

function number(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function username(value: string) {
  return `@${value.trim().replace(/^@+/, '')}`;
}

function title(doc: jsPDF, value: string, y = 30) {
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(value, 18, y);
}

function decorations(doc: jsPDF) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setFillColor(...PAPER);
  doc.rect(0, 0, width, height, 'F');
  doc.setFillColor(...MINT);
  doc.ellipse(18, -5, 42, 24, 'F');
  doc.setFillColor(...PINK);
  doc.ellipse(width - 11, 8, 30, 18, 'F');
  doc.setFillColor(...ORANGE);
  doc.ellipse(8, height + 5, 25, 20, 'F');
  doc.setFillColor(222, 203, 202);
  doc.ellipse(width - 15, height + 2, 28, 22, 'F');
}

function footer(doc: jsPDF, page: number, companyName: string) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 125);
  doc.text('D\'BEST Influence · KOL Performance Report', 18, height - 7);
  doc.text(String(page), width - 18, height - 7, { align: 'right' });
  doc.setFillColor(...PAPER);
  doc.rect(16, height - 11, 120, 7, 'F');
  doc.setTextColor(100, 116, 125);
  doc.text(`${companyName} - KOL Performance Report`, 18, height - 7);
}

function addPage(doc: jsPDF, page: number, companyName: string) {
  if (page > 1) doc.addPage();
  decorations(doc);
  footer(doc, page, companyName);
}

async function imageData(url: string | null): Promise<{ data: string; width: number; height: number } | null> {
  if (!url) return null;
  try {
    const storedImage = url.startsWith('data:image/');
    const response = storedImage
      ? null
      : await fetch(url.startsWith('/')
        ? url
        : `/api/tracking/detail-report/thumbnail?url=${encodeURIComponent(url)}`);
    if (response && !response.ok) return null;
    const objectUrl = storedImage ? url : URL.createObjectURL(await response!.blob());
    return await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d')?.drawImage(image, 0, 0);
        if (!storedImage) URL.revokeObjectURL(objectUrl);
        resolve({ data: canvas.toDataURL('image/jpeg', 0.88), width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        if (!storedImage) URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      image.src = objectUrl;
    });
  } catch {
    return null;
  }
}

function metricRows(item: ReportItem) {
  const report = item.report;
  if (!report) return [];
  return [
    ['Followers', item.followers], ['Views', report.views], ['Play', report.plays],
    ['Likes', report.likes], ['Comments', report.comments], ['Saves', report.saves],
    ['Shares', report.shares], ['Repost', report.reposts], ['AVG Duration View', report.duration],
  ].filter((row): row is [string, number] => Number(row[1]) > 0);
}

function captionImage(value: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1312;
  canvas.height = 224;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const padding = 36;
  const maxWidth = canvas.width - padding * 2;
  const lineHeight = 38;
  const maxLines = Math.floor((canvas.height - padding * 2) / lineHeight);
  context.fillStyle = '#f8f9f8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#414f57';
  context.font = '26px Arial, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  context.textBaseline = 'top';

  const lines: string[] = [];
  const paragraphs = value.replace(/\r\n/g, '\n').trim().split('\n');
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of paragraph.trim().split(/\s+/u)) {
      if (context.measureText(word).width > maxWidth) {
        if (current) { lines.push(current); current = ''; }
        let chunk = '';
        for (const character of Array.from(word)) {
          if (context.measureText(chunk + character).width > maxWidth && chunk) {
            lines.push(chunk);
            chunk = character;
          } else {
            chunk += character;
          }
        }
        current = chunk;
        continue;
      }
      const candidate = current ? `${current} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = word;
    }
    if (current) lines.push(current);
  }

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines && visibleLines.length) {
    let last = visibleLines[visibleLines.length - 1].replace(/[.\s]+$/u, '');
    while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    visibleLines[visibleLines.length - 1] = `${last}…`;
  }
  visibleLines.forEach((line, index) => context.fillText(line, padding, padding + index * lineHeight, maxWidth));
  return canvas.toDataURL('image/png');
}

function compactCaptionImage(value: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1060;
  canvas.height = 220;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const padding = 28;
  const maxWidth = canvas.width - padding * 2;
  const lineHeight = 72;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#26343b';
  context.font = '40px Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  context.textBaseline = 'top';

  const lines: string[] = [];
  let current = '';
  for (const word of value.replace(/\s+/gu, ' ').trim().split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  const visibleLines = lines.slice(0, 2);
  if (lines.length > 2 && visibleLines.length) {
    let last = visibleLines[visibleLines.length - 1];
    while (last && context.measureText(`${last}…`).width > maxWidth) last = Array.from(last).slice(0, -1).join('');
    visibleLines[visibleLines.length - 1] = `${last}…`;
  }
  visibleLines.forEach((line, index) => context.fillText(line, padding, 24 + index * lineHeight, maxWidth));
  return canvas.toDataURL('image/png');
}

function phone(doc: jsPDF, x: number, y: number, heading: string) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(25, 35, 40);
  doc.setLineWidth(0.7);
  doc.roundedRect(x, y, 61, 151, 4, 4, 'FD');
  doc.setFillColor(20, 25, 28);
  doc.roundedRect(x + 20, y + 3, 21, 4, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...NAVY);
  doc.text(heading, x + 30.5, y + 13, { align: 'center' });
  doc.setDrawColor(225, 229, 231);
  doc.line(x + 2, y + 17, x + 59, y + 17);
}

function insightRow(doc: jsPDF, x: number, y: number, label: string, value: string) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(61, 72, 78);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(value, x + 49, y, { align: 'right' });
}

function duration(value: number) {
  const seconds = Math.max(0, Math.round(value));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const rest = seconds % 60;
  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`, `${rest}s`].filter(Boolean).join(' ');
}

function donutChart(values: number[]) {
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 500;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const colors = ['#f000b8', '#7b2cff', '#ff8a00', '#24c7a5', '#ef476f'];
  const total = values.reduce((sum, value) => sum + value, 0);
  context.clearRect(0, 0, 500, 500);
  context.lineWidth = 62;
  context.lineCap = 'butt';
  let start = -Math.PI / 2;
  (total ? values : [1]).forEach((value, index) => {
    const end = start + (value / (total || 1)) * Math.PI * 2;
    context.beginPath();
    context.strokeStyle = colors[index % colors.length];
    context.arc(250, 250, 180, start, end);
    context.stroke();
    start = end;
  });
  return canvas.toDataURL('image/png');
}

function rateBar(doc: jsPDF, x: number, y: number, label: string, value: number, color: [number, number, number]) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...NAVY);
  doc.text(label, x, y);
  doc.text(`${value.toFixed(2)}%`, x + 50, y, { align: 'right' });
  doc.setFillColor(234, 237, 239);
  doc.roundedRect(x, y + 2, 50, 3.5, 1.5, 1.5, 'F');
  doc.setFillColor(...color);
  doc.roundedRect(x, y + 2, 50 * Math.min(value / 100, 1), 3.5, 1.5, 1.5, 'F');
}

function semiGauge(doc: jsPDF, centerX: number, centerY: number, radius: number) {
  const segments = 48;
  doc.setLineWidth(3.5);
  doc.setLineCap('round');
  for (let index = 0; index < segments; index++) {
    const start = Math.PI + index / segments * Math.PI;
    const end = Math.PI + (index + 0.82) / segments * Math.PI;
    const progress = index / (segments - 1);
    doc.setDrawColor(
      Math.round(88 + progress * 145),
      Math.round(25 - progress * 10),
      Math.round(230 - progress * 39),
    );
    doc.line(
      centerX + Math.cos(start) * radius,
      centerY + Math.sin(start) * radius,
      centerX + Math.cos(end) * radius,
      centerY + Math.sin(end) * radius,
    );
  }
}

function quickMetricIcon(type: 'like' | 'comment' | 'share' | 'repost' | 'save') {
  const paths = {
    like: 'M20.8 4.6c-1.5-1.5-4-1.5-5.5 0L12 7.9 8.7 4.6a3.9 3.9 0 0 0-5.5 5.5L12 19l8.8-8.9a3.9 3.9 0 0 0 0-5.5Z',
    comment: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-4-.9L3 21l1.7-4.5A8.4 8.4 0 1 1 21 11.5Z',
    share: 'M22 2 15 22l-4-9-9-4 20-7ZM11 13 22 2',
    repost: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
    save: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z',
  } as const;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.scale(128 / 24, 128 / 24);
  context.strokeStyle = '#151b1e';
  context.lineWidth = 1.8;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke(new Path2D(paths[type]));
  return canvas.toDataURL('image/png');
}

async function shortVideoInsightsPage(doc: jsPDF, item: ReportItem) {
  const report = item.report!;
  const xs = [20, 85, 150, 215];
  const y = 42;
  const interactions = report.likes + report.comments + report.saves + report.shares + report.reposts;
  const viewRatio = item.followers > 0 ? report.views / item.followers * 100 : 0;
  const rate = (value: number) => report.views > 0 ? value / report.views * 100 : 0;
  const platform = normalizePlatform(item.platform) ?? 'instagram';
  const platformInfo = SOCIAL_PLATFORMS[platform];
  const thumbnail = await imageData(report.thumbnail_url) ?? await imageData(DEFAULT_THUMBNAIL);

  title(doc, username(item.username), 29);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(79, 101, 112);
  doc.text(`${item.creatorName} · ${item.platform}${item.sow ? ` · ${item.sow}` : ''}`, 19, 37);

  phone(doc, xs[0], y, `${platformInfo.label} thumbnail`);
  if (thumbnail) {
    const maxWidth = 55;
    const maxHeight = 125;
    const scale = Math.min(maxWidth / thumbnail.width, maxHeight / thumbnail.height);
    const imageWidth = thumbnail.width * scale;
    const imageHeight = thumbnail.height * scale;
    try {
      doc.addImage(thumbnail.data, 'JPEG', xs[0] + 3 + (maxWidth - imageWidth) / 2,
        y + 20 + (maxHeight - imageHeight) / 2, imageWidth, imageHeight, undefined, 'FAST');
    } catch { /* default phone background remains */ }
  }

  phone(doc, xs[1], y, `${platformInfo.label} analytics`);
  if (thumbnail) {
    const miniScale = Math.min(13 / thumbnail.width, 10 / thumbnail.height);
    try {
      doc.addImage(thumbnail.data, 'JPEG', xs[1] + 30.5 - thumbnail.width * miniScale / 2,
        y + 19, thumbnail.width * miniScale, thumbnail.height * miniScale, undefined, 'FAST');
    } catch { /* analytics content remains available without the mini cover */ }
  }
  const analyticsCaption = compactCaptionImage(report.caption || '-');
  if (analyticsCaption) doc.addImage(analyticsCaption, 'PNG', xs[1] + 4, y + 30, 53, 10, undefined, 'FAST');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(105, 116, 123);
  doc.text(`Duration ${report.duration.toFixed(1)}s`, xs[1] + 30.5, y + 43, { align: 'center' });

  const quickMetrics = [
    ['like', report.likes], ['comment', report.comments], ['share', report.shares],
    ['repost', report.reposts], ['save', report.saves],
  ] as const;
  quickMetrics.forEach(([icon, value], index) => {
    const metricX = xs[1] + 7 + index * 11.7;
    const iconImage = quickMetricIcon(icon);
    if (iconImage) doc.addImage(iconImage, 'PNG', metricX - 2.4, y + 46.5, 4.8, 4.8, undefined, 'FAST');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.3);
    doc.setTextColor(...NAVY);
    doc.text(number(value), metricX, y + 56, { align: 'center' });
  });
  doc.setDrawColor(226, 229, 231);
  doc.line(xs[1] + 3, y + 61, xs[1] + 58, y + 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text('Overview', xs[1] + 5, y + 69);
  insightRow(doc, xs[1] + 5, y + 78, 'Views', number(report.views));
  insightRow(doc, xs[1] + 5, y + 86, 'Watch time (est.)', duration(report.views * report.duration));
  insightRow(doc, xs[1] + 5, y + 94, 'Interactions', number(interactions));
  doc.setDrawColor(226, 229, 231);
  doc.line(xs[1] + 3, y + 100, xs[1] + 58, y + 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Views', xs[1] + 5, y + 108);
  semiGauge(doc, xs[1] + 30.5, y + 146, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(number(report.views), xs[1] + 30.5, y + 139, { align: 'center' });

  phone(doc, xs[2], y, `${platformInfo.label} performance`);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Views compared with followers', xs[2] + 4, y + 29);
  doc.setFontSize(18);
  doc.text(`${viewRatio.toFixed(1)}%`, xs[2] + 30.5, y + 48, { align: 'center' });
  doc.setFillColor(235, 237, 239);
  doc.roundedRect(xs[2] + 5, y + 57, 51, 5, 2, 2, 'F');
  doc.setFillColor(224, 0, 156);
  doc.roundedRect(xs[2] + 5, y + 57, 51 * Math.min(viewRatio / 100, 1), 5, 2, 2, 'F');
  rateBar(doc, xs[2] + 5, y + 76, 'Like rate', rate(report.likes), [240, 0, 184]);
  rateBar(doc, xs[2] + 5, y + 91, 'Save rate', rate(report.saves), [123, 44, 255]);
  rateBar(doc, xs[2] + 5, y + 106, 'Share rate', rate(report.shares), [255, 138, 0]);
  rateBar(doc, xs[2] + 5, y + 121, 'Engagement rate', rate(interactions), [36, 199, 165]);

  phone(doc, xs[3], y, `${platformInfo.label} interactions`);
  const donut = donutChart([report.likes, report.comments, report.saves, report.shares, report.reposts]);
  if (donut) doc.addImage(donut, 'PNG', xs[3] + 8, y + 24, 45, 45, undefined, 'FAST');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(number(interactions), xs[3] + 30.5, y + 51, { align: 'center' });
  doc.setFontSize(5.5);
  doc.text('TOTAL', xs[3] + 30.5, y + 59, { align: 'center' });
  insightRow(doc, xs[3] + 5, y + 82, 'Likes', number(report.likes));
  insightRow(doc, xs[3] + 5, y + 93, 'Comments', number(report.comments));
  insightRow(doc, xs[3] + 5, y + 104, 'Saves', number(report.saves));
  insightRow(doc, xs[3] + 5, y + 115, 'Shares', number(report.shares));
  insightRow(doc, xs[3] + 5, y + 126, 'Reposts', number(report.reposts));
  const legendColors: Array<[number, number, number]> = [
    [240, 0, 184], [123, 44, 255], [255, 138, 0], [36, 199, 165], [239, 71, 111],
  ];
  legendColors.forEach((color, index) => {
    doc.setFillColor(...color);
    doc.circle(xs[3] + 3, y + 80 + index * 11, 1, 'F');
  });
}

export async function createDetailReportPdf(payload: DetailReportPayload) {
  const companyLogo = await loadCompanyLogo();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const reportItems = payload.items.filter((item) => item.report);
  const companyName = String(payload.project.dbest?.name ?? '').trim() || '-';
  let page = 1;

  addPage(doc, page, companyName);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  const coverTitle = doc.splitTextToSize(`${String(payload.project.brand ?? 'Brand').toUpperCase()}\n${payload.project.name}\nKOL Report`, 230);
  doc.text(coverTitle, 18, 68);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(`Project ${payload.project.code}`, 18, 145);
  doc.text(`Prepared by ${payload.project.pic || companyName}`, 18, 154);
  if (companyLogo) doc.addImage(companyLogo, 'PNG', width - 91, 124, 72, 38, undefined, 'FAST');

  page++;
  addPage(doc, page, companyName);
  title(doc, 'Campaign Overview');
  const totalViews = reportItems.reduce((sum, item) => sum + (item.report?.views ?? 0), 0);
  const totalEngagement = reportItems.reduce((sum, item) => sum + (item.report?.likes ?? 0) +
    (item.report?.comments ?? 0) + (item.report?.saves ?? 0) + (item.report?.shares ?? 0) + (item.report?.reposts ?? 0), 0);
  const averagePerformance = reportItems.length
    ? reportItems.reduce((sum, item) => sum + (item.report?.performance ?? 0), 0) / reportItems.length : 0;
  doc.setFillColor(...GREEN);
  doc.circle(width / 2, 60, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(String(reportItems.length), width / 2, 63, { align: 'center' });
  autoTable(doc, {
    startY: 84,
    body: [
      ['Total Content', `${reportItems.length} posts`],
      ['Total Views', number(totalViews)],
      ['Total Engagement', number(totalEngagement)],
      ['Average Performance', `${averagePerformance.toFixed(2)}%`],
    ],
    theme: 'plain', margin: { left: 88, right: 88 },
    styles: { fontSize: 14, textColor: NAVY, cellPadding: 3, lineColor: [105, 121, 113], lineWidth: { bottom: 0.3 } },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });

  page++;
  addPage(doc, page, companyName);
  title(doc, 'Campaign Performance Overview');
  autoTable(doc, {
    startY: 40,
    head: [['Creator', 'Platform', 'Followers', 'Views', 'Likes', 'Comments', 'Saves', 'Shares', 'Repost', 'ER']],
    body: reportItems.map((item) => [
      username(item.username), item.platform, number(item.followers), number(item.report?.views ?? 0),
      number(item.report?.likes ?? 0), number(item.report?.comments ?? 0), number(item.report?.saves ?? 0),
      number(item.report?.shares ?? 0), number(item.report?.reposts ?? 0), `${(item.report?.performance ?? 0).toFixed(2)}%`,
    ]),
    theme: 'grid', margin: { left: 8, right: 8 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
    bodyStyles: { textColor: NAVY, halign: 'center', fontSize: 8, lineColor: [102, 147, 128] },
  });

  for (const item of reportItems) {
    page++;
    addPage(doc, page, companyName);
    const mappedPlatform = normalizePlatform(item.platform);
    if (mappedPlatform) {
      await shortVideoInsightsPage(doc, item);
      continue;
    }
    title(doc, username(item.username));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(91, 108, 118);
    doc.text(`${item.creatorName} · ${item.platform}${item.sow ? ` · ${item.sow}` : ''}`, 19, 38);

    const thumbnail = await imageData(item.report?.thumbnail_url ?? null)
      ?? await imageData(DEFAULT_THUMBNAIL);
    doc.setFillColor(241, 245, 244);
    doc.roundedRect(18, 46, 78, 132, 3, 3, 'F');
    doc.setDrawColor(31, 41, 45);
    doc.setLineWidth(1.2);
    doc.roundedRect(20, 48, 74, 128, 5, 5, 'S');
    doc.setFillColor(31, 41, 45);
    doc.roundedRect(46, 50, 22, 3, 1.5, 1.5, 'F');
    doc.roundedRect(50, 171, 14, 1.5, 0.75, 0.75, 'F');
    if (thumbnail) {
      const maxWidth = 68;
      const maxHeight = 112;
      const scale = Math.min(maxWidth / thumbnail.width, maxHeight / thumbnail.height);
      const imageWidth = thumbnail.width * scale;
      const imageHeight = thumbnail.height * scale;
      const imageX = 23 + (maxWidth - imageWidth) / 2;
      const imageY = 56 + (maxHeight - imageHeight) / 2;
      try { doc.addImage(thumbnail.data, 'JPEG', imageX, imageY, imageWidth, imageHeight, undefined, 'FAST'); } catch { /* fallback panel remains */ }
    }

    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Content Performance', 109, 51);
    const metrics = metricRows(item);
    metrics.forEach(([label, value], index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 109 + col * 55;
      const y = 60 + row * 29;
      doc.setFillColor(246, 248, 247);
      doc.roundedRect(x, y, 50, 23, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(95, 112, 121);
      doc.text(label, x + 3, y + 7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...NAVY);
      doc.text(number(value), x + 3, y + 16);
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Caption', 109, 148);
    doc.setFillColor(248, 249, 248);
    doc.roundedRect(109, 152, 164, 28, 2, 2, 'F');
    const renderedCaption = captionImage(item.report?.caption || '-');
    if (renderedCaption) doc.addImage(renderedCaption, 'PNG', 109, 152, 164, 28, undefined, 'FAST');
  }

  return doc;
}

export async function exportDetailReportPdf(payload: DetailReportPayload) {
  const doc = await createDetailReportPdf(payload);
  const safeName = `${payload.project.brand ?? 'Brand'}_${payload.project.name}_KOL_Report`
    .replace(/[^a-z0-9_-]+/gi, '_');
  doc.save(`${safeName}.pdf`);
}
