import Swal from "sweetalert2";

export const confirmDelete = async (title = "Delete Data?") => {
  return Swal.fire({
    title,
    text: "You won't be able to revert this!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, Delete",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    confirmButtonColor: "#dc2626",
  });
};

export const showSuccess = async (
  title = "Success",
  text = "Data has been processed successfully."
) => {
  return Swal.fire({
    icon: "success",
    title,
    text,
    timer: 1500,
    showConfirmButton: false,
  });
};

export const confirmGenerateQuotation = async () => {
  return Swal.fire({
    title: "Generate Quotation?",
    text: "The project draft will be processed into a quotation.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, Generate",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    confirmButtonColor: "#16a34a",
  });
};

export const confirmStartProject = async () => {
  return Swal.fire({
    title: "Start Project?",
    text: "The project will be moved to the Running stage.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, Start",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    confirmButtonColor: "#16a34a",
  });
};

export const confirmGenerateReport = async () => {
  return Swal.fire({
    title: "Generate Report?",
    text: "The campaign will be moved to the Report stage.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, Generate",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    confirmButtonColor: "#16a34a",
  });
};

export type ManualReportInput = {
  likes: number;
  views: number;
  comments: number;
  saves: number;
  shares: number;
  reposts: number;
  plays: number;
  duration: number;
  caption: string;
  thumbnailDataUrl?: string;
};

export const chooseReportInputMode = async (action: "input" | "update" = "input") => {
  const result = await Swal.fire({
    title: "Report Data Source",
    text: "Choose how the content performance data will be entered.",
    icon: "question",
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: "Scrape from Link",
    denyButtonText: action === "update" ? "Update Manually" : "Input Manually",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#0284c7",
    denyButtonColor: "#0f172a",
  });

  if (result.isConfirmed) return "scrape" as const;
  if (result.isDenied) return "manual" as const;
  return null;
};

export const showManualReportModal = async (
  creatorName: string,
  initial: Partial<ManualReportInput> = {},
) => {
  const escapeHtml = (value: string) =>
    value.replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[character] ?? character);

  const fields = [
    ["likes", "Likes *", "1"],
    ["views", "Views *", "1"],
    ["comments", "Comments", "1"],
    ["saves", "Saves", "1"],
    ["shares", "Shares", "1"],
    ["reposts", "Reposts", "1"],
    ["plays", "Plays", "1"],
    ["duration", "AVG Duration (seconds)", "0.1"],
  ];

  const result = await Swal.fire<ManualReportInput>({
    title: `Manual Report - ${escapeHtml(creatorName)}`,
    width: 720,
    html: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:left">
        ${fields.map(([id, label, step]) => `
          <label style="font-size:13px;font-weight:600;color:#334155">${label}
            <input id="manual_${id}" type="number" min="0" step="${step}" value="${Number(initial[id as keyof ManualReportInput] ?? 0)}"
              style="display:block;width:100%;height:44px;margin-top:6px;border:1px solid #cbd5e1;border-radius:8px;padding:0 12px;box-sizing:border-box" />
          </label>`).join("")}
      </div>
      <label style="display:block;margin-top:14px;text-align:left;font-size:13px;font-weight:600;color:#334155">Caption (optional)
        <textarea id="manual_caption" rows="3"
          style="display:block;width:100%;margin-top:6px;border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;box-sizing:border-box">${escapeHtml(initial.caption ?? "")}</textarea>
      </label>
      <label style="display:block;margin-top:14px;text-align:left;font-size:13px;font-weight:600;color:#334155">Thumbnail (optional)
        <input id="manual_thumbnail" type="file" accept="image/jpeg,image/png,image/webp,image/avif"
          style="display:block;width:100%;margin-top:6px;border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;box-sizing:border-box" />
        <small style="display:block;margin-top:5px;color:#64748b;font-weight:400">JPG, PNG, WEBP, atau AVIF. Maksimal 3 MB.</small>
      </label>`,
    showCancelButton: true,
    confirmButtonText: "Save Manual Data",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#0f172a",
    focusConfirm: false,
    preConfirm: async () => {
      const readNumber = (id: string) =>
        Number((document.getElementById(`manual_${id}`) as HTMLInputElement)?.value);
      const values = Object.fromEntries(fields.map(([id]) => [id, readNumber(id)])) as
        unknown as Omit<ManualReportInput, "caption" | "thumbnailDataUrl">;

      if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) {
        Swal.showValidationMessage("All metrics must be numbers equal to or greater than 0.");
        return false;
      }
      if (![values.likes, values.views, values.comments, values.saves, values.shares, values.reposts, values.plays]
        .every(Number.isInteger)) {
        Swal.showValidationMessage("Like, view, and interaction counts must be whole numbers.");
        return false;
      }

      const thumbnailInput = document.getElementById("manual_thumbnail") as HTMLInputElement;
      const thumbnail = thumbnailInput?.files?.[0];
      let thumbnailDataUrl: string | undefined;
      if (thumbnail) {
        const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
        if (!allowedTypes.has(thumbnail.type)) {
          Swal.showValidationMessage("Thumbnail harus berupa JPG, PNG, WEBP, atau AVIF.");
          return false;
        }
        if (thumbnail.size > 3_000_000) {
          Swal.showValidationMessage("Ukuran thumbnail maksimal 3 MB.");
          return false;
        }
        thumbnailDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Thumbnail gagal dibaca."));
          reader.readAsDataURL(thumbnail);
        }).catch(() => "");
        if (!thumbnailDataUrl) {
          Swal.showValidationMessage("Thumbnail gagal dibaca.");
          return false;
        }
      }

      return {
        ...values,
        caption: (document.getElementById("manual_caption") as HTMLTextAreaElement)?.value.trim() ?? "",
        thumbnailDataUrl,
      };
    },
  });

  return result.isConfirmed ? result.value ?? null : null;
};

type PaymentOption = {
  pyt_id: number;
  pyt_bank: string | null;
  pyt_norek: string | null;
  pyt_nama: string | null;
};

export const confirmGenerateInvoice = async (payments: PaymentOption[]) => {
  const escapeHtml = (value: string | null) =>
    String(value ?? "-").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[character] ?? character);
  const paymentOptions = payments
    .map((payment) => `<option value="${payment.pyt_id}">${escapeHtml(payment.pyt_bank)}</option>`)
    .join("");

  return new Promise<{ prj_paymentid: number } | null>((resolve) => {
    Swal.fire({
    willClose: () => {
      // Resolve with null if the user closes the modal without submitting
      // This handles clicking the 'x', pressing Esc, or clicking outside
      resolve(null);
    },
    showConfirmButton: false,
    showCloseButton: false,
    width: 700,
    padding: 0,

    html: `
      <div style="padding:24px">

        <div
          style="
            background:#f0ab3d;
            color:white;
            font-weight:600;
            font-size:15px;
            letter-spacing:1px;
            padding:14px;
            border-radius:8px;
            position:relative;
            text-align:center;
            margin-bottom:20px;
          "
        >
          Select Payment Account

          <span
            id="closeInvoiceModal"
            style="
              position:absolute;
              right:18px;
              top:50%;
              transform:translateY(-50%);
              font-size:32px;
              line-height:1;
              cursor:pointer;
              color:black;
              font-weight:bold;
            "
          >
            ×
          </span>
        </div>

        <div style="text-align:left">
          <label
            style="
              display:block;
              margin-bottom:6px;
              font-size:16px;
              color:#555;
            "
          >
            Bank Name <span style="color:#ef4444">*</span>
          </label>

          <select
            id="paymentId"
            style="
              width:100%;
              height:50px;
              border:1px solid #d1d5db;
              border-radius:8px;
              padding:0 14px;
              font-size:16px;
              box-sizing:border-box;
            "
          >
            <option value="">Select Bank</option>
            ${paymentOptions}
          </select>

          <div
            id="bankNameError"
            style="
              display:none;
              color:#ef4444;
              font-size:13px;
              margin-top:5px;
            "
          >
            Select a bank
          </div>
        </div>

        <div style="margin-top:16px;text-align:left">
          <label
            style="
              display:block;
              margin-bottom:6px;
              font-size:16px;
              color:#555;
            "
          >
            Account No
          </label>

          <input
            id="accountNo"
            placeholder="Account No"
            readonly
            style="
              width:100%;
              height:50px;
              border:1px solid #d1d5db;
              background:#f8fafc;
              border-radius:8px;
              padding:0 14px;
              font-size:16px;
              box-sizing:border-box;
            "
          />

          <div
            id="accountNoError"
            style="
              display:none;
              color:#ef4444;
              font-size:13px;
              margin-top:5px;
            "
          >
            Account No is required
          </div>
        </div>

        <div style="margin-top:16px;text-align:left">
          <label
            style="
              display:block;
              margin-bottom:6px;
              font-size:16px;
              color:#555;
            "
          >
            Account Name
          </label>

          <input
            id="accountName"
            placeholder="Account Name"
            readonly
            style="
              width:100%;
              height:50px;
              border:1px solid #d1d5db;
              background:#f8fafc;
              border-radius:8px;
              padding:0 14px;
              font-size:16px;
              box-sizing:border-box;
            "
          />

          <div
            id="accountNameError"
            style="
              display:none;
              color:#ef4444;
              font-size:13px;
              margin-top:5px;
            "
          >
            Account name is required
          </div>
        </div>

        <button
          id="submitInvoice"
          style="
            width:100%;
            height:54px;
            margin-top:24px;
            border:none;
            border-radius:8px;
            background:black;
            color:white;
            font-size:16px;
            font-weight:600;
            cursor:pointer;
          "
        >
          Next Generate Invoice
        </button>

      </div>
    `,

    didOpen: () => {
      document
        .getElementById("closeInvoiceModal")
        ?.addEventListener("click", () => {
          Swal.close();
        });

      document
        .getElementById("submitInvoice")
        ?.addEventListener("click", () => {
          const paymentId = document.getElementById(
            "paymentId"
          ) as HTMLSelectElement;

          const accountNo = document.getElementById(
            "accountNo"
          ) as HTMLInputElement;

          const accountName = document.getElementById(
            "accountName"
          ) as HTMLInputElement;

          const bankNameError =
            document.getElementById("bankNameError");

          const accountNoError =
            document.getElementById("accountNoError");

          const accountNameError =
            document.getElementById("accountNameError");

          // Reset style
          paymentId.style.border = "1px solid #d1d5db";
          accountNo.style.border = "1px solid #d1d5db";
          accountName.style.border = "1px solid #d1d5db";

          bankNameError!.style.display = "none";
          accountNoError!.style.display = "none";
          accountNameError!.style.display = "none";

          let isValid = true;

          if (!paymentId.value) {
            paymentId.style.border = "2px solid #ef4444";
            bankNameError!.style.display = "block";
            isValid = false;
          }

          if (!isValid) return;

          resolve({
            prj_paymentid: Number(paymentId.value),
          });

          Swal.close();
        });
      const paymentId = document.getElementById("paymentId") as HTMLSelectElement;
      const accountNo = document.getElementById("accountNo") as HTMLInputElement;
      const accountName = document.getElementById("accountName") as HTMLInputElement;

      paymentId?.addEventListener("change", () => {
        const selectedPayment = payments.find(
          (payment) => payment.pyt_id === Number(paymentId.value)
        );
        accountNo.value = selectedPayment?.pyt_norek ?? "";
        accountName.value = selectedPayment?.pyt_nama ?? "";
      });
    },

  });
  });
};

export const confirmFinishProject = async () => {
  return Swal.fire({

    title: "Finish Project?",
    text: "The project will be marked as finished and cannot be changed again.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, Finish",

    cancelButtonText: "Cancel",
    reverseButtons: true,
    confirmButtonColor: "#16a34a",
  });
};


export const showAlertValidationError = (message: string = "Please Select Min 1 KOL") => {
  return Swal.fire({
    title: "",
    text: message,
    icon: "error",
    iconColor: "#C22A1E", 
    confirmButtonColor: "#000000",
    confirmButtonText: "OK",
    customClass: {
      popup: "rounded-xl font-sans",
      title: "text-xl font-bold text-slate-900",
      htmlContainer: "text-lg font-bold text-slate-900 pt-2",
    },
    showCloseButton: true,
  });
};


export const showAlertSuccess = (message: string) => {
  return Swal.fire({
    title: "Success",
    text: message,
    icon: "success",
    confirmButtonColor: "#000000",
    customClass: {
      popup: "rounded-xl font-sans",
    },
        showCloseButton: true,
  });
};

export const showRunningContentModal = async (
  data: {
    id: number;
    name: string;
    planning_upload: string;
    actual_upload: string;
    link_content: string;
  },
  mode: "edit" | "view"
) => {
  const isView = mode === "view";

  return new Promise((resolve) => {
    Swal.fire({
      showConfirmButton: false,
      showCloseButton: false,
      width: 700,
      padding: 0,

      html: `
      <div style="padding:24px">

        <div
          style="
            background:#f0ab3d;
            color:white;
            font-weight:600;
            font-size:15px;
            padding:14px;
            border-radius:8px;
            position:relative;
            text-align:center;
            margin-bottom:20px;
          "
        >
          ${isView ? "View Running Content" : "Edit Running Content"}

          <span
            id="closeRunningModal"
            style="
              position:absolute;
              right:18px;
              top:50%;
              transform:translateY(-50%);
              font-size:30px;
              cursor:pointer;
              color:black;
              font-weight:bold;
            "
          >
            ×
          </span>
        </div>

        ${isView ? "" : `
        <div style="text-align:left">
          <label>Influencer Name</label>

          <input
            value="${data.name}"
            readonly
            style="
              width:100%;
              height:50px;
              margin-top:6px;
              border:1px solid #d1d5db;
              border-radius:8px;
              padding:0 14px;
              box-sizing:border-box;
              background-color:#eee;
            "
          />
        </div>
        `}

        <div
          style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:12px;
            margin-top:16px;
          "
        >
          <div>
            <label>Planning Upload <span style="color:#ef4444">*</span></label>

            <input
              id="planning_upload"
              type="date"
              value="${data.planning_upload}"
              ${isView ? "readonly" : ""}
              style="
                width:100%;
                height:50px;
                margin-top:6px;
                border:1px solid #d1d5db;
                border-radius:8px;
                padding:0 14px;
                box-sizing:border-box;
              "
            />
          </div>

          <div>
            <label>Actual Upload <span style="color:#ef4444">*</span></label>

            <input
              id="actual_upload"
              type="date"
              value="${data.actual_upload}"
              ${isView ? "readonly" : ""}
              style="
                width:100%;
                height:50px;
                margin-top:6px;
                border:1px solid #d1d5db;
                border-radius:8px;
                padding:0 14px;
                box-sizing:border-box;
              "
            />
          </div>
        </div>

        <div style="margin-top:16px;text-align:left">
          <label>Link Content <span style="color:#ef4444">*</span></label>

          <input
            id="link_content"
            value="${data.link_content}"
            ${isView ? "readonly" : ""}
            style="
              width:100%;
              height:50px;
              margin-top:6px;
              border:1px solid #d1d5db;
              border-radius:8px;
              padding:0 14px;
              box-sizing:border-box;
            "
          />
        </div>

        ${
          !isView
            ? `
          <button
            id="updateRunning"
            style="
              width:100%;
              height:52px;
              margin-top:24px;
              border:none;
              border-radius:8px;
              background:black;
              color:white;
              font-weight:600;
              cursor:pointer;
            "
          >
            Update Data
          </button>
        `
            : ""
        }

      </div>
    `,

      didOpen: () => {
        document
          .getElementById("closeRunningModal")
          ?.addEventListener("click", () => {
            Swal.close();
            resolve(null);
          });

        const updateButton = document.getElementById("updateRunning");
        if (updateButton) {
          updateButton.addEventListener("click", async () => {
            const planning_upload =
              (document.getElementById("planning_upload") as HTMLInputElement)
                ?.value || "";
            const actual_upload =
              (document.getElementById("actual_upload") as HTMLInputElement)
                ?.value || "";
            const link_content =
              (document.getElementById("link_content") as HTMLInputElement)
                ?.value || "";

            resolve({
              planning_upload,
              actual_upload,
              link_content,
            });
            Swal.close();
          });
        }
      },
    });
  });
};

export const confirmApproveCreator = async () => {
  return Swal.fire({
    title: "Approve Content?",
    text: "The creator's content will be marked as complete and ready for review.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, Approve",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    confirmButtonColor: "#16a34a",

  });
};
