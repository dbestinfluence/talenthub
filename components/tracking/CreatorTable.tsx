import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";

import EyeIcon from "@/components/icons/EyeIcon";
import DeleteIcon from "@/components/icons/DeleteIcon";
import EditIcon from "@/components/icons/EditIcon";
import CheckIcon from "@/components/icons/CheckIcon";
import InvoiceIcon from "@/components/icons/InvoiceIcon";
import { isSowForPlatform } from "@/lib/social-platform";

const DEFAULT_CREATOR_PHOTO = "/image/default-kol-avatar.png";

function getPhotoSrc(creator: any): string | null {
  const rawUrl = creator.photo || creator.photo_url || creator.photoUrl;
  if (!rawUrl) return null;

  const normalizedUrl = String(rawUrl).trim();
  if (!normalizedUrl) return null;

  // Local/public images do not need to pass through the remote image proxy.
  if (normalizedUrl.startsWith("/") || normalizedUrl.startsWith("data:")) {
    return normalizedUrl;
  }

  try {
    const hostname = new URL(normalizedUrl).hostname.toLowerCase();
    const requiresProxy = [
      "cdninstagram.com",
      "fbcdn.net",
      "tiktokcdn.com",
      "tiktokcdn-us.com",
      "ibyteimg.com",
    ].some((host) => hostname === host || hostname.endsWith(`.${host}`));

    return requiresProxy
      ? "/api/image-proxy?url=" + encodeURIComponent(normalizedUrl)
      : normalizedUrl;
  } catch {
    return null;
  }
}

function getRawPhotoSrc(creator: any): string | null {
  const value = String(creator.photo || creator.photo_url || creator.photoUrl || "").trim();
  return value || null;
}

function PhotoCell(props: { creator: any }) {
  const creator = props.creator;
  const photoSrc = getPhotoSrc(creator);
  const rawPhotoSrc = getRawPhotoSrc(creator);

  return (
    <div className="w-16 h-16 rounded-lg overflow-hidden bg-blue-100 flex items-center justify-center mx-auto">
      <img
        src={photoSrc || DEFAULT_CREATOR_PHOTO}
        alt={creator.name || "Creator"}
        className="w-full h-full object-cover"
        onError={(event) => {
          const image = event.currentTarget;
          if (rawPhotoSrc?.startsWith("http") && image.dataset.directTried !== "true") {
            image.dataset.directTried = "true";
            image.src = rawPhotoSrc;
            return;
          }
          if (!image.src.endsWith(DEFAULT_CREATOR_PHOTO)) image.src = DEFAULT_CREATOR_PHOTO;
        }}
      />
    </div>
  );
}

function DraftPriceInput({
  value,
  label,
  invalid,
  onCommit,
}: {
  value: number | null | undefined;
  label: string;
  invalid: boolean;
  onCommit: (value: number | null) => void;
}) {
  const [inputValue, setInputValue] = useState(
    value && value > 0 ? String(value) : ""
  );

  useEffect(() => {
    setInputValue(value && value > 0 ? String(value) : "");
  }, [value]);

  return (
    <div className="min-w-36">
      <input
        type="text"
        inputMode="numeric"
        required
        aria-label={label}
        value={inputValue}
        placeholder="Required"
        onChange={(event) =>
          setInputValue(event.target.value.replace(/\D/g, ""))
        }
        onBlur={() => onCommit(inputValue ? Number(inputValue) : null)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={`w-full rounded-md border px-3 py-2 text-right outline-none ${
          invalid
            ? "border-red-500 bg-red-50 text-red-700"
            : "border-slate-300 bg-white focus:border-sky-500"
        }`}
      />
      {invalid && (
        <p className="mt-1 text-xs font-semibold text-red-600">
          Required, numbers only
        </p>
      )}
    </div>
  );
}

type Props = {
  creators: any[];
  sowOptions?: { sow_id: number; sow_nama: string | null }[];
  onSowChange?: (creatorId: number, sowId: number | null) => void;
  sowReadOnly?: boolean;
  invalidSowCreatorIds?: number[];
  reportMode?: boolean;
  runningMode?: boolean;
  draftPricingMode?: boolean;
  draftPricingEditable?: boolean;
  invalidPricingFields?: Record<
    number,
    { rateCard: boolean; markupPrice: boolean; qty: boolean }
  >;
  onDraftPriceChange?: (
    creatorId: number,
    field: "rateCard" | "markupPrice" | "qty",
    value: number | null
  ) => void;
  onAddSow?: (creatorId: number) => void;
  invalidRunningFields?: Record<
    number,
    {
      planningUpload: boolean;
      actualUpload: boolean;
      linkContent: boolean;
    }
  >;
  getSortIcon: (field: string) => ReactNode;
  showDelete?: boolean;
  onDelete?: (id: number) => void;
  onEdit?: (id: number) => void;
  showView?: boolean;
  onView?: (creator: any) => void;
  onCheck?: (id: number) => void;
  checkedCreators?: number[];
  selectedReportIds?: number[];
  onReportSelectionChange?: (ids: number[]) => void;
  onOpenReport?: (detailIds: number[]) => void;
  openingReportIds?: number[];
  handleSort: (field: string) => void;
};

export default function CreatorTable({
  creators,
  sowOptions,
  onSowChange,
  sowReadOnly = false,
  invalidSowCreatorIds = [],
  reportMode = false,
  runningMode = false,
  draftPricingMode = false,
  draftPricingEditable = false,
  invalidPricingFields = {},
  onDraftPriceChange,
  onAddSow,
  invalidRunningFields = {},
  handleSort,
  getSortIcon,
  showDelete = false,
  onDelete,
  onEdit,
  showView = false,
  onView,
  onCheck,
  checkedCreators = [],
  selectedReportIds = [],
  onReportSelectionChange,
  onOpenReport,
  openingReportIds = [],
}: Props) {
  const pageSize = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(creators.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const visibleCreators = creators.slice(startIndex, startIndex + pageSize);

  const headers = reportMode
    ? [
        { label: "No.", field: "no" },
        { label: "Photo", field: "photo" },
        { label: "Influencer Name", field: "name" },
        { label: "Username", field: "username" },
        { label: "URL Content", field: "drf_link_content" },
        { label: "SOW", field: "sow" },
      ]
    : [
        { label: "No.", field: "no" },
        { label: "Photo", field: "photo" },
        { label: "Influencer Name", field: "name" },
        { label: "Username", field: "username" },
        { label: "Followers", field: "followers" },
        { label: "Post", field: "post" },
        { label: "ER (%)", field: "engagementRate" },
        { label: "Avr View", field: "averageView" },
        { label: "Avr Brand", field: "averageViewBrand" },
        { label: "CPV All", field: "cpvAll" },
        { label: "CPV Branded", field: "cpvBranded" },
        { label: "SOW", field: "sow" },
        { label: "Platform", field: "platform" },
        { label: "Qty", field: "qty" },
        ...(draftPricingMode
          ? [
              { label: "Rate Card", field: "rateCard" },
              { label: "Mark Price", field: "markupPrice" },
            ]
          : [
              { label: "Rate Card", field: "rateCard" },
              { label: "Mark Price", field: "markupPrice" },
            ]),
        { label: "Total", field: "total" },
        ...(runningMode
          ? [
              { label: "Planning Upload", field: "drf_planning_upload" },
              { label: "Actual Upload", field: "drf_actual_upload" },
              { label: "Link Content", field: "drf_link_content" },
            ]
          : []),
      ];

  function renderReportRow(creator: any, index: number) {
    const isOpeningReport = openingReportIds.includes(creator.drf_id);

    return (
      <tr
        key={creator.id}
        className="border-b border-gray-200 hover:bg-gray-50 text-gray-800"
      >
        <td className="border-x px-4 py-3 text-center">
          <input
            type="checkbox"
            aria-label={`Select ${creator.name || "creator"}`}
            checked={selectedReportIds.includes(creator.drf_id)}
            onChange={(event) => {
              onReportSelectionChange?.(
                event.target.checked
                  ? [...new Set([...selectedReportIds, creator.drf_id])]
                  : selectedReportIds.filter((id) => id !== creator.drf_id)
              );
            }}
            className="h-4 w-4 accent-sky-500"
          />
        </td>
        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {startIndex + index + 1}
        </td>
        <td className="p-3 border-r border-gray-200 text-center">
          <PhotoCell creator={creator} />
        </td>
        <td className="p-3 border-r border-gray-200 font-medium whitespace-nowrap">
          {creator.name}
        </td>
        <td className="p-3 border-r border-gray-200 text-gray-500 whitespace-nowrap">
          {creator.username}
        </td>
        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {creator.drf_link_content ? (
            <a
              href={creator.drf_link_content}
              target="_blank"
              rel="noreferrer"
              className="text-sky-600 hover:underline"
            >
              View content
            </a>
          ) : (
            "-"
          )}
        </td>
        <td className="p-3 border-r border-gray-200 whitespace-nowrap">
          {creator.sow ? creator.sow : "-"}
        </td>
        <td className="p-3 text-center whitespace-nowrap sticky right-0 bg-white">
          {showView ? (
            <button
              type="button"
              onClick={() => onOpenReport?.([creator.drf_id])}
              disabled={!onOpenReport || isOpeningReport}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            >
              <InvoiceIcon className="h-4 w-4 text-slate-900" />
              <span>{isOpeningReport ? "Loading..." : "View"}</span>
            </button>
          ) : (
            "-"
          )}
        </td>
      </tr>
    );
  }

  function renderNormalRow(creator: any, index: number) {
    const detailHref = "/tracking/detail/detail/" + creator.drf_creatorid;
    const hasInvalidSow = invalidSowCreatorIds.includes(creator.drf_id);
    const invalidRunning = invalidRunningFields[creator.drf_id];
    const usedSowIds = new Set(
      creators
        .filter(
          (item) =>
            item.drf_creatorid === creator.drf_creatorid &&
            item.drf_id !== creator.drf_id
        )
        .map((item) => item.sowId)
        .filter(Boolean)
    );

    return (
      <tr
        key={creator.id}
        className="border-b border-gray-200 hover:bg-gray-50 text-gray-800"
      >
        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {startIndex + index + 1}
        </td>

        <td className="p-3 border-r border-gray-200 text-center">
          <PhotoCell creator={creator} />
        </td>

        <td className="p-3 border-r border-gray-200 font-medium whitespace-nowrap">
          {creator.name}
        </td>

        <td className="p-3 border-r border-gray-200 text-gray-500 whitespace-nowrap">
          {creator.username}
        </td>

        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {creator.followers ? creator.followers.toLocaleString("en-US") : "-"}
        </td>

        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {creator.totalPost ? creator.totalPost.toLocaleString("en-US") : "-"}
        </td>

        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {creator.engagementRate ? creator.engagementRate.toFixed(2) : "0.00"}%
        </td>

        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {creator.averageView ? creator.averageView.toLocaleString("en-US") : "-"}
        </td>

        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {creator.averageViewBrand
            ? creator.averageViewBrand.toLocaleString("en-US")
            : "-"}
        </td>

        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {creator.markupPrice && creator.averageView
            ? "Rp" +
              Math.round(
                creator.markupPrice / creator.averageView
              ).toLocaleString("en-US")
            : "-"}
        </td>

        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {creator.markupPrice && creator.averageViewBrand
            ? "Rp" +
              Math.round(
                creator.markupPrice / creator.averageViewBrand
              ).toLocaleString("en-US")
            : "-"}
        </td>

        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {sowOptions ? (
            <select
              value={creator.sowId ? creator.sowId : ""}
              disabled={sowReadOnly}
              onChange={(event) => {
                const val =
                  event.target.value === "" ? null : Number(event.target.value);
                if (onSowChange) onSowChange(creator.drf_id, val);
              }}
              className={
                hasInvalidSow
                  ? "min-w-40 rounded-md border px-2 py-1.5 text-sm outline-none border-red-500 bg-red-50 text-red-700"
                  : "min-w-40 rounded-md border px-2 py-1.5 text-sm outline-none border-slate-300 bg-white text-slate-700"
              }
            >
              <option value="">Select SOW</option>
              {sowOptions.filter((sow) => isSowForPlatform(sow.sow_nama, creator.platform)).map((sow) => (
                <option
                  key={sow.sow_id}
                  value={sow.sow_id}
                  disabled={usedSowIds.has(sow.sow_id)}
                >
                  {sow.sow_nama ? sow.sow_nama : "SOW #" + sow.sow_id}
                </option>
              ))}
            </select>
          ) : creator.sow ? (
            creator.sow
          ) : (
            "-"
          )}
        </td>

        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {creator.platform ? creator.platform : "-"}
        </td>

        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {draftPricingMode && draftPricingEditable ? (
            <DraftPriceInput
              value={creator.drf_qty}
              label={`Qty for ${creator.name || "creator"}`}
              invalid={Boolean(invalidPricingFields[creator.drf_id]?.qty)}
              onCommit={(value) =>
                onDraftPriceChange?.(creator.drf_id, "qty", value)
              }
            />
          ) : (
            creator.drf_qty ?? "-"
          )}
        </td>

        {draftPricingMode ? (
          <>
            <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
              {draftPricingEditable ? (
                <DraftPriceInput
                  value={creator.rateCard}
                  label={`Rate Card for ${creator.name || "creator"}`}
                  invalid={Boolean(
                    invalidPricingFields[creator.drf_id]?.rateCard
                  )}
                  onCommit={(value) =>
                    onDraftPriceChange?.(creator.drf_id, "rateCard", value)
                  }
                />
              ) : creator.rateCard ? (
                creator.rateCard.toLocaleString("en-US")
              ) : (
                "-"
              )}
            </td>
            <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
              {draftPricingEditable ? (
                <DraftPriceInput
                  value={creator.markupPrice}
                  label={`Mark Price for ${creator.name || "creator"}`}
                  invalid={Boolean(
                    invalidPricingFields[creator.drf_id]?.markupPrice
                  )}
                  onCommit={(value) =>
                    onDraftPriceChange?.(creator.drf_id, "markupPrice", value)
                  }
                />
              ) : creator.markupPrice ? (
                creator.markupPrice.toLocaleString("en-US")
              ) : (
                "-"
              )}
            </td>
          </>
        ) : (
          <>
            <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
              {creator.rateCard ? creator.rateCard.toLocaleString("en-US") : "-"}
            </td>
            <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
              {creator.markupPrice
                ? creator.markupPrice.toLocaleString("en-US")
                : "-"}
            </td>
          </>
        )}

        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
          {creator.total ? creator.total.toLocaleString("en-US") : "-"}
        </td>

        {runningMode ? (
          <>
            <td
              className={
                invalidRunning && invalidRunning.planningUpload
                  ? "p-3 border-r border-gray-200 text-center whitespace-nowrap bg-red-50 font-medium text-red-700"
                  : "p-3 border-r border-gray-200 text-center whitespace-nowrap"
              }
            >
              {creator.drf_planning_upload ? (
                new Date(creator.drf_planning_upload).toLocaleDateString(
                  "en-GB",
                  { day: "numeric", month: "long", year: "numeric" }
                )
              ) : (
                <>
                  <span>-</span>
                  {invalidRunning && invalidRunning.planningUpload ? (
                    <p className="mt-1 text-xs font-bold text-red-700">
                      Required
                    </p>
                  ) : null}
                </>
              )}
            </td>
            <td
              className={
                invalidRunning && invalidRunning.actualUpload
                  ? "p-3 border-r border-gray-200 text-center whitespace-nowrap bg-red-50 font-medium text-red-700"
                  : "p-3 border-r border-gray-200 text-center whitespace-nowrap"
              }
            >
              {creator.drf_actual_upload ? (
                new Date(creator.drf_actual_upload).toLocaleDateString(
                  "en-GB",
                  { day: "numeric", month: "long", year: "numeric" }
                )
              ) : (
                <>
                  <span>-</span>
                  {invalidRunning && invalidRunning.actualUpload ? (
                    <p className="mt-1 text-xs font-bold text-red-700">
                      Required
                    </p>
                  ) : null}
                </>
              )}
            </td>
            <td
              className={
                invalidRunning && invalidRunning.linkContent
                  ? "p-3 border-r border-gray-200 text-center whitespace-nowrap bg-red-50 font-medium text-red-700"
                  : "p-3 border-r border-gray-200 text-center whitespace-nowrap"
              }
            >
              {creator.drf_link_content ? (
                <a
                  href={creator.drf_link_content}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 hover:underline"
                >
                  View content
                </a>
              ) : (
                <>
                  <span>-</span>
                  {invalidRunning && invalidRunning.linkContent ? (
                    <p className="mt-1 text-xs font-bold text-red-700">
                      Required
                    </p>
                  ) : null}
                </>
              )}
            </td>
          </>
        ) : null}

        <td className="sticky right-0 min-w-[220px] whitespace-nowrap bg-white p-3 text-center">
          <div className="flex flex-nowrap items-center justify-center gap-2">
            {draftPricingMode && draftPricingEditable && onAddSow ? (
              <button
                type="button"
                onClick={() => onAddSow(creator.drf_id)}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                + Add SOW
              </button>
            ) : null}
            {showView && onView ? (
              runningMode ? (
                <button
                  type="button"
                  onClick={() => onView(creator)}
                  aria-label={`View running content for ${creator.name}`}
                  className="cursor-pointer"
                >
                  <EyeIcon className="h-5 w-5 text-sky-600" />
                </button>
              ) : (
                <Link href={detailHref} className="cursor-pointer">
                  <EyeIcon className="h-5 w-5 text-sky-600" />
                </Link>
              )
            ) : null}
            {onEdit ? (
              <button onClick={() => onEdit(creator.drf_id)}>
                <EditIcon className="h-5 w-5 text-blue-500" />
              </button>
            ) : null}
            {showDelete ? (
              <button
                type="button"
                aria-label={`Delete ${creator.name} from draft`}
                title="Delete creator"
                onClick={() => {
                  if (onDelete) onDelete(creator.drf_id);
                }}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-70"
              >
                <DeleteIcon className="h-5 w-5 text-red-500" />
              </button>
            ) : null}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="mt-6">
      <div className="overflow-x-auto border border-gray-200 rounded-lg w-full max-h-[500px] overflow-y-auto">
        <table
          className={
            reportMode
              ? "min-w-[900px] w-full text-sm border-collapse"
              : "min-w-[1500px] w-full text-sm border-collapse"
          }
        >
          <thead>
            <tr className="border-y border-slate-400 bg-slate-300 text-left text-slate-900">
              {reportMode && (
                <th className="border-x px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all creators on this page"
                    checked={
                      visibleCreators.length > 0 &&
                      visibleCreators.every((creator) =>
                        selectedReportIds.includes(creator.drf_id)
                      )
                    }
                    onChange={(event) => {
                      const pageIds = visibleCreators.map(
                        (creator) => creator.drf_id
                      );
                      onReportSelectionChange?.(
                        event.target.checked
                          ? [...new Set([...selectedReportIds, ...pageIds])]
                          : selectedReportIds.filter(
                              (id) => !pageIds.includes(id)
                            )
                      );
                    }}
                    className="h-4 w-4 accent-sky-500"
                  />
                </th>
              )}

              {headers.map((head) => (
                <th
                  key={head.field}
                  onClick={() => handleSort(head.field)}
                  className="p-3 border-r border-gray-200 font-semibold text-gray-700 whitespace-nowrap bg-gray-100 cursor-pointer hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <span>
                      {head.label}
                      {(
                        draftPricingMode && ["sow", "qty", "rateCard", "markupPrice"].includes(head.field)
                      ) || (
                        runningMode && ["drf_planning_upload", "drf_actual_upload", "drf_link_content"].includes(head.field)
                      ) ? <span className="ml-1 text-red-500">*</span> : null}
                    </span>
                    <span className="text-gray-400 text-xs ml-1">
                      {getSortIcon(head.field)}
                    </span>
                  </div>
                </th>
              ))}
              <th className="sticky right-0 min-w-[220px] whitespace-nowrap border-r border-gray-200 bg-gray-100 p-3 text-center font-semibold text-gray-700">
                Action Detail
              </th>
            </tr>
          </thead>

          <tbody>
            {visibleCreators.map((creator, index) =>
              reportMode
                ? renderReportRow(creator, index)
                : renderNormalRow(creator, index)
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
        <span>
          Showing {creators.length > 0 ? startIndex + 1 : 0} to{" "}
          {Math.min(startIndex + pageSize, creators.length)} of{" "}
          {creators.length} entries
        </span>

        {totalPages > 1 ? (
          <div className="flex border border-gray-200 rounded-md overflow-hidden items-center bg-white">
            <button
              type="button"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
              className="px-3 py-1 bg-gray-100 border-r border-gray-200 disabled:opacity-50 hover:bg-gray-200"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setCurrentPage(pageNumber)}
                  className={
                    pageNumber === safeCurrentPage
                      ? "px-3 py-1 border-r border-gray-200 bg-blue-50 font-bold text-blue-600"
                      : "px-3 py-1 border-r border-gray-200 hover:bg-gray-50 text-gray-700"
                  }
                >
                  {pageNumber}
                </button>
              )
            )}

            <button
              type="button"
              disabled={safeCurrentPage === totalPages}
              onClick={() =>
                setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))
              }
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
