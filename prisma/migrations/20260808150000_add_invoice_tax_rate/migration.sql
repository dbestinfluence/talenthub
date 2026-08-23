ALTER TABLE "trs_project"
ADD COLUMN "prj_invoice_tax_rate" DECIMAL(5,2);

-- Existing invoices initially retain the tax rate that was previously shared
-- by Quotation and Invoice. Future invoices may update this snapshot alone.
UPDATE "trs_project"
SET "prj_invoice_tax_rate" = "prj_tax_rate"
WHERE "prj_status" >= 5
  AND "prj_invoice_tax_rate" IS NULL;
