import * as XLSX from "xlsx-js-style";

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);

  if (typeof value === "string") {
    const normalized = value
      .trim()
      .replace(/^Rp\s*/i, "")
      .replace(/\s/g, "")
      .replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateCpv(markPrice: unknown, averageView: unknown): number {
  const price = toFiniteNumber(markPrice);
  const views = toFiniteNumber(averageView);
  return views > 0 ? price / views : 0;
}

export const createExcelWorkbook = (
  creators: any[],
  projectDetail: any
) => {
  // 1. Define headers for the table
  const headers = [
    "No.",
    "Influencer Name",
    "Username",
    "Followers",
    "Total Post",
    "ER (%)",
    "Avg. View",
    "Avg. Brand View",
    "CPV All",
    "CPV Brand",
    "SOW",
    "Platform",
    "Qty",
    "Rate Card",
    "Total",
  ];

  // 2. Map creator data to the desired format
  const data = creators.map((creator, index) => ({
    "No.": index + 1,
    "Influencer Name": creator.name ?? "-",
    Username: creator.username ?? "-",
    Followers: toFiniteNumber(creator.followers),
    "Total Post": toFiniteNumber(creator.totalPost),
    "ER (%)": toFiniteNumber(creator.engagementRate),
    "Avg. View": toFiniteNumber(creator.averageView),
    "Avg. Brand View": toFiniteNumber(creator.averageViewBrand),
    // Always calculate from the business source fields at export time. This
    // avoids stale/ formatted CPV values from the React table state.
    "CPV All": calculateCpv(creator.markupPrice, creator.averageView),
    "CPV Brand": calculateCpv(creator.markupPrice, creator.averageViewBrand),
    SOW: creator.sow ?? "-",
    Platform: creator.platform ?? "-",
    Qty: toFiniteNumber(creator.drf_qty ?? creator.qty),
    "Rate Card": toFiniteNumber(creator.markupPrice),
    Total: toFiniteNumber(creator.total),
  }));

  // 3. Create worksheet and add data in sections
  const ws = XLSX.utils.aoa_to_sheet([
    [`Project: ${projectDetail?.name ?? "Untitled Project"}`],
    [`Brand: ${projectDetail?.brand ?? "-"}`],
    [`PIC: ${projectDetail?.createdBy ?? "-"} | Date: ${projectDetail?.createdAt ? new Date(projectDetail.createdAt).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}`],
  ]);

  // Merge title cells
  ws["!merges"] = [
    XLSX.utils.decode_range("A1:O1"),
    XLSX.utils.decode_range("A2:O2"),
    XLSX.utils.decode_range("A3:O3"),
  ];

  // Add main data table with headers
  XLSX.utils.sheet_add_json(ws, data, {
    origin: "A5", // Start data table on row 5
    skipHeader: false,
  });

  // 4. Define styles
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFFFF" } },
    fill: { fgColor: { rgb: "FF4F81BD" } }, // Blue color
    alignment: { horizontal: "center", vertical: "center" },
  };

  const allBorders = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  // Apply title styles
  ws["A1"].s = { font: { bold: true, sz: 16 }, alignment: { horizontal: "center" } };
  ws["A2"].s = { font: { sz: 12 }, alignment: { horizontal: "center" } };
  ws["A3"].s = { font: { sz: 10, italic: true }, alignment: { horizontal: "center" } };

  const range = XLSX.utils.decode_range(ws["!ref"]!);

  // 5. Apply style to header (now on row 5, which is index 4)
  const headerRowIndex = 4;
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
    if (!ws[address]) continue;
    ws[address].s = headerStyle;
  }

  // 6. Apply borders and number formats to all data cells
  for (let R = range.s.r; R <= range.e.r; ++R) {
    // Skip title and empty rows
    if (R < headerRowIndex) continue;

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell_address = { c: C, r: R };
      const cell_ref = XLSX.utils.encode_cell(cell_address);
      if (!ws[cell_ref]) continue;

      // Apply border only to data table
      if (R >= headerRowIndex) {
        ws[cell_ref].s = { ...ws[cell_ref].s, border: allBorders };
      }

      // Apply number formats to data table rows
      if (R > headerRowIndex) {
        if (C >= 3 && C <= 14) {
          // Columns from Followers to Total
          if (typeof ws[cell_ref].v === 'number') {
            ws[cell_ref].t = "n";
            ws[cell_ref].s.numFmt = "#,##0";
          }
        }
        if (C === 5) {
          // ER (%) column
          ws[cell_ref].s.numFmt = "0.00%";
        }
        if (C === 8 || C === 9 || C === 13 || C === 14) {
          // Keep CPV, Rate Card, and Total numeric while displaying Rupiah.
          ws[cell_ref].t = "n";
          ws[cell_ref].s.numFmt = '"Rp" #,##0';
        }
      }
    }
  }

  // 7. Set column widths
  ws["!cols"] = [
    { wch: 5 },   // No.
    { wch: 25 },  // Influencer Name
    { wch: 20 },  // Username
    { wch: 12 },  // Followers
    { wch: 10 },  // Total Post
    { wch: 8 },   // ER (%)
    { wch: 12 },  // Avg. View
    { wch: 12 },  // Avg. Brand View
    { wch: 12 },  // CPV All
    { wch: 12 },  // CPV Branded
    { wch: 30 },  // SOW
    { wch: 15 },  // Platform
    { wch: 5 },   // Qty
    { wch: 15 },  // Rate Card
    { wch: 15 },  // Total
  ];

  // 8. Set worksheet features
  // Freeze header row
  ws["!view"] = { freezePanes: { y: 5 } };
  // Add autofilter
  ws["!autofilter"] = { ref: `A5:O${data.length + 5}` };

  // 9. Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Creators");

  return wb;
};

export const exportToExcel = (
  creators: any[],
  projectDetail: any,
  fileName: string
) => {
  const wb = createExcelWorkbook(creators, projectDetail);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const createExcelBlob = (creators: any[], projectDetail: any) => {
  const wb = createExcelWorkbook(creators, projectDetail);
  const workbookData = XLSX.write(wb, { bookType: "xlsx", type: "array" });

  return new Blob([workbookData], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};
