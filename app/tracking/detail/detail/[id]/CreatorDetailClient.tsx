"use client";

import { useState, useMemo, useEffect } from "react";
import DefaultLayout from "@/components/Layout/DefaultLayout";
import {
  computeInsightsFromPosts,
  type RawPostLike,
} from "@/lib/insights";

type IconProps = { className?: string };

function Icon({
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const Users = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);
const Heart = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
  </Icon>
);
const MessageCircle = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.8 9.8 0 0 1-4.2-.9L3 21l1.9-4.8A8.4 8.4 0 1 1 21 11.5Z" />
  </Icon>
);
const Eye = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const EyeOff = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-3.05 4.06M6.61 6.61A13.5 13.5 0 0 0 2 11s3.5 7 10 7a9.24 9.24 0 0 0 4.31-1.04M2 2l20 20" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
  </Icon>
);
const TrendingUp = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M14 7h7v7" />
  </Icon>
);
const Target = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </Icon>
);
const ImageOff = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m2 2 20 20M10.4 10.4a2 2 0 1 1 2.8 2.8M10.5 5H5a2 2 0 0 0-2 2v12c0 .6.2 1.1.6 1.4M21 15V7a2 2 0 0 0-2-2h-4M3 16l4-4 7 7M14 14l1-1 6 6" />
  </Icon>
);
const Share2 = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49" />
  </Icon>
);
const Repeat2 = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m2 9 3-3 3 3" />
    <path d="M13 18H7a4 4 0 0 1-4-4V6" />
    <path d="m22 15-3 3-3-3" />
    <path d="M11 6h6a4 4 0 0 1 4 4v8" />
  </Icon>
);
const Bookmark = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Icon>
);
const Info = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </Icon>
);

type Profile = {
  id: number;
  name: string;
  username: string;
  photoUrl: string | null;

  followers: number;
  following: number | null;

  socialMedia: string;

  totalPosts: number;
  totalPost: number;

  lastScrapedAt: string | null;

  // ============================
  // DATABASE METRICS mst_creators
  // ============================

  averageView: number;
  averageViewBrand: number;

  avgLikes: number;
  avgComments: number;

  avgShares: number;
  avgSaves: number;
  avgReposts: number;

  erFollowers: number;
  erViews: number;
  erTalenthub: number;

  topHashtags: {
    tag: string;
    count: number;
  }[];

  topMentions: {
    mention: string;
    count: number;
  }[];
};

type Post = RawPostLike & { id: number };

type PerformancePeriod = "all" | "7" | "30" | "60" | "90";

const PERFORMANCE_PERIODS: {
  value: PerformancePeriod;
  label: string;
}[] = [
  { value: "all", label: "Data All" },
  { value: "7", label: "Last H-7 days" },
  { value: "30", label: "H-30" },
  { value: "60", label: "H-60" },
  { value: "90", label: "H-90" },
];

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
}

function formatOptionalMetric(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "—";
  }
  return formatNumber(value);
}

// Instagram sends -1 (instead of a real count) when the creator has hidden
// the like count on that post. Treat any negative value as "hidden", not
// as an actual number, so we never render a raw "-1" to the user.
function isHiddenCount(value: number): boolean {
  return value < 0;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function proxied(url?: string | null): string {
  const value = String(url ?? "").trim();
  if (!value) return "";
  if (value.startsWith("/") || value.startsWith("data:image/")) return value;

  /*
   * File di Vercel Blob sudah public dan stabil, jadi gunakan URL-nya
   * secara langsung. Jangan lewatkan ke /api/image-proxy karena proxy
   * dapat membatasi host eksternal dan menyebabkan gambar tidak tampil.
   */
  try {
    const hostname = new URL(value).hostname.toLowerCase();

    if (
      hostname === "blob.vercel-storage.com" ||
      hostname.endsWith(".blob.vercel-storage.com")
    ) {
      return value;
    }
  } catch {
    return "";
  }

  return "/api/image-proxy?url=" + encodeURIComponent(value);
}

/**
 * Avatar default hanya boleh dipakai untuk foto profil.
 * Jangan pernah menampilkannya sebagai thumbnail konten.
 */
function imageIdentity(value?: string | null): string {
  const url = String(value ?? "").trim();

  if (!url) return "";

  if (url.startsWith("data:image/")) {
    return url;
  }

  try {
    const parsed = new URL(url, "https://talenthub.local");

    return (
      parsed.hostname.toLowerCase() +
      parsed.pathname.toLowerCase().replace(/\/+$/, "")
    );
  } catch {
    return url.toLowerCase().split("?")[0];
  }
}

function contentThumbnailSource(
  thumbnailUrl?: string | null,
  profilePhotoUrl?: string | null
): string {
  const thumbnail = String(thumbnailUrl ?? "").trim();

  if (!thumbnail) return "";

  /*
   * Ada data lama yang menyimpan foto profil sebagai thumbnail post.
   * Jika gambar post sama dengan foto profil, anggap thumbnail tidak ada.
   */
  if (
    profilePhotoUrl &&
    imageIdentity(thumbnail) === imageIdentity(profilePhotoUrl)
  ) {
    return "";
  }

  const normalizedThumbnail = thumbnail.toLowerCase().split("?")[0];

  if (
    normalizedThumbnail.includes("default-kol-avatar") ||
    normalizedThumbnail.includes("default-profile") ||
    normalizedThumbnail.includes("profile-placeholder") ||
    normalizedThumbnail.includes("user-placeholder")
  ) {
    return "";
  }

  return proxied(thumbnail);
}

// Outline-icon-in-a-box style, matching the step-indicator look
// (rounded square, border, icon centered, light tint background).
function MetricCard(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
  info?: string;
}) {
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;

      if (!target.closest("[data-info-card]")) {
        setShowInfo(false);
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowInfo(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);

      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div
      data-info-card
      className="
        relative
        flex
        items-center
        gap-4
        rounded-xl
        border
        border-slate-200
        bg-white
        p-5
      "
    >
      <div
        className={
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 " +
          props.tint
        }
      >
        {props.icon}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p
            className="
            text-xs
            font-medium
            tracking-wide
            text-slate-400
          "
          >
            {props.label.toUpperCase()}
          </p>

          {props.info && (
            <button
              onClick={(e) => {
                e.stopPropagation();

                setShowInfo((prev) => !prev);
              }}
              className="
                flex
                h-5
                w-5
                items-center
                justify-center
                rounded-full
                text-slate-400
                transition
                hover:bg-slate-100
                hover:text-indigo-500
              "
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>

        <p
          className="
          mt-1
          text-xl
          font-bold
          text-slate-800
        "
        >
          {props.value}
        </p>
      </div>

      {showInfo && props.info && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="
            absolute
            right-3
            top-14
            z-50
            w-80
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-5
            shadow-xl
            animate-in
            fade-in
            zoom-in-95
            duration-200
          "
        >
          {/* Header */}

          <div
            className="
            mb-3
            flex
            items-center
            justify-between
          "
          >
            <div
              className="
              flex
              items-center
              gap-2
            "
            >
              <div
                className="
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-full
                bg-indigo-50
                text-indigo-500
              "
              >
                <Info className="h-4 w-4" />
              </div>

              <span
                className="
                text-sm
                font-bold
                text-slate-700
              "
              >
                Detail Formula
              </span>
            </div>

            <button
              onClick={() => setShowInfo(false)}
              className="
                rounded-full
                px-2
                text-slate-400
                hover:bg-slate-100
              "
            >
              ✕
            </button>
          </div>

          {/* Content */}

          <div
            className="
            rounded-xl
            bg-slate-50
            p-3
            text-sm
            leading-relaxed
            text-slate-600
            whitespace-pre-line
          "
          >
            {props.info}
          </div>

          <div
            className="
            mt-3
            text-xs
            text-slate-400
          "
          >
            Click outside the popup or press ESC to close.
          </div>
        </div>
      )}
    </div>
  );
}

// Card shell filled with real hashtag/mention pills when data is available.
function TagListCard({
  title,
  items,
  variant,
  height = "h-40",
}: {
  title: string;
  items: string[];
  variant: "hashtag" | "mention";
  height?: string;
}) {
  const prefix = variant === "hashtag" ? "#" : "@";
  const pillClass =
    variant === "hashtag"
      ? "bg-indigo-50 text-indigo-600"
      : "bg-sky-50 text-sky-600";

  return (
    <div
      className={
        "flex flex-col rounded-xl border border-slate-200 p-4 " + height
      }
    >
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      <div className="mt-3 flex flex-1 flex-wrap items-start gap-2 overflow-y-auto">
        {items.length > 0 ? (
          items.map((item) => (
            <span
              key={item}
              className={
                "rounded-full px-3 py-1 text-xs font-medium " + pillClass
              }
            >
              {prefix}
              {item}
            </span>
          ))
        ) : (
          <span className="text-sm italic text-slate-400">No data yet</span>
        )}
      </div>
    </div>
  );
}

// Bigger card for the content grid: large square thumbnail on top,
// likes/comments/views/shares/saves as caption underneath.
function PostCard({
  post,
  profilePhotoUrl,
}: {
  post: Post;
  profilePhotoUrl: string | null;
}) {
  const likesHidden = isHiddenCount(post.likes);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const thumbnailSrc = contentThumbnailSource(
    post.thumbnailUrl,
    profilePhotoUrl
  );

  return (
    <a
      href={post.postUrl || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 transition hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-slate-100">
        {thumbnailSrc && !thumbnailFailed ? (
          <img
            src={thumbnailSrc}
            alt=""
            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
            onError={() => setThumbnailFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-50">
            <ImageOff className="h-12 w-12 text-slate-300" />
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-3 gap-x-2 gap-y-3 p-4">
        {/* Likes */}
        {likesHidden ? (
          <p
            className="flex items-center justify-center gap-1.5 text-xs font-medium italic text-slate-400"
            title="The creator hid the like count on this post"
          >
            <EyeOff className="h-4 w-4 text-slate-400" />
            Hide
          </p>
        ) : (
          <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700">
            <Heart className="h-4 w-4 text-rose-500" />
            {formatNumber(post.likes)}
          </p>
        )}

        {/* Comments */}
        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <MessageCircle className="h-4 w-4 text-emerald-500" />
          {formatNumber(post.comments)}
        </p>

        {/* Views */}
        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Eye className="h-4 w-4 text-sky-500" />
          {formatOptionalMetric(post.views)}
        </p>

        {/* Shares */}
        <p
          className="flex items-center justify-center gap-1.5 text-xs text-slate-500"
          title={
            post.shares == null ? "Share data is not available" : undefined
          }
        >
          <Share2 className="h-4 w-4 text-indigo-500" />
          {formatOptionalMetric(post.shares)}
        </p>

        {/* Saves */}
        <p
          className="flex items-center justify-center gap-1.5 text-xs text-slate-500"
          title={post.saves == null ? "Save data is not available" : undefined}
        >
          <Bookmark className="h-4 w-4 text-amber-500" />
          {formatOptionalMetric(post.saves)}
        </p>

        {/* Reposts */}
        <p
          className="flex items-center justify-center gap-1.5 text-xs text-slate-500"
          title={
            post.reposts == null ? "Repost data is not available" : undefined
          }
        >
          <Repeat2 className="h-4 w-4 text-violet-500" />
          {formatOptionalMetric(post.reposts)}
        </p>
      </div>
    </a>
  );
}

export default function CreatorDetailClient(props: {
  profile: Profile;
  posts: Post[];
}) {
  const { profile, posts } = props;
  const [performancePeriod, setPerformancePeriod] =
    useState<PerformancePeriod>("all");

  const performancePosts = useMemo(() => {
    if (performancePeriod === "all") return posts;

    const days = Number(performancePeriod);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    return posts.filter((post) => {
      const postedTime = new Date(post.postedAt).getTime();
      return !Number.isNaN(postedTime) && postedTime >= cutoff;
    });
  }, [posts, performancePeriod]);

  const performance = useMemo(
    () =>
      computeInsightsFromPosts(
        performancePosts,
        profile.followers,
        0
      ),
    [performancePosts, profile.followers]
  );

  const defaultProfilePhoto = "/image/default-kol-avatar.png";
  const photoSrc = proxied(profile.photoUrl) || defaultProfilePhoto;
  const followingText =
    profile.following !== null ? formatNumber(profile.following) : "-";

  // Top 5 ikut periode aktif dan diurutkan berdasarkan total engagement.
  const topPosts = useMemo(() => {
    const engagement = (post: Post) =>
      Math.max(0, post.likes ?? 0) +
      Math.max(0, post.comments ?? 0) +
      Math.max(0, post.shares ?? 0) +
      Math.max(0, post.saves ?? 0) +
      Math.max(0, post.reposts ?? 0);

    return [...performancePosts]
      .sort((a, b) => {
        const difference = engagement(b) - engagement(a);
        if (difference !== 0) return difference;

        return (
          new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
        );
      })
      .slice(0, 5);
  }, [performancePosts]);

  return (
    <DefaultLayout>
      <div className="space-y-6">
        {/* Profile card */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="h-24 bg-[#E3A458]" />
          <div className="px-6 pb-6">
            <img
              src={photoSrc}
              alt={profile.name}
              onError={(event) => {
                const image = event.currentTarget;
                const rawUrl = String(profile.photoUrl ?? "").trim();

                /*
                 * Untuk URL CDN lama: jika proxy gagal, coba URL asli
                 * satu kali sebelum memakai avatar default.
                 */
                if (
                  /^https?:\/\//i.test(rawUrl) &&
                  image.dataset.directTried !== "true" &&
                  image.src !== rawUrl
                ) {
                  image.dataset.directTried = "true";
                  image.src = rawUrl;
                  return;
                }

                if (!image.src.endsWith(defaultProfilePhoto)) {
                  image.src = defaultProfilePhoto;
                }
              }}
              className="-mt-10 h-20 w-20 rounded-2xl border-4 border-white object-cover"
            />
            <h1 className="mt-3 text-xl font-bold text-slate-800">
              {profile.name}
            </h1>
            <p className="text-sm text-slate-500">
              @{profile.username}{" "}
              <span className="text-xs uppercase text-slate-400">
                · {profile.socialMedia}
              </span>
            </p>

            <div className="mt-4 flex gap-6 text-sm">
              <span className="text-slate-400">
                POSTS{" "}
                <span className="font-bold text-slate-800">
                  {formatNumber(profile.totalPost)}
                </span>
              </span>

              <span className="text-slate-400">
                FOLLOWERS{" "}
                <span className="font-bold text-slate-800">
                  {formatNumber(profile.followers)}
                </span>
              </span>

              <span className="text-slate-400">
                FOLLOWING{" "}
                <span className="font-bold text-slate-800">
                  {followingText}
                </span>
              </span>
            </div>
          </div>
        </section>

        {/* User Performance */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                User Performance
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Calculated from {performancePosts.length} stored contents
              </p>
            </div>

            <div className="overflow-x-auto">
              <div className="inline-flex min-w-max gap-1 rounded-xl border border-[#F0D8BA] bg-[#FBF4EB] p-1">
                {PERFORMANCE_PERIODS.map((period) => {
                  const active = performancePeriod === period.value;

                  return (
                    <button
                      key={period.value}
                      type="button"
                      onClick={() => setPerformancePeriod(period.value)}
                      className={[
                        "rounded-lg px-4 py-2 text-sm font-semibold transition",
                        active
                          ? "bg-[#E3A458] text-white shadow-sm"
                          : "text-[#8A6235] hover:bg-white/70 hover:text-[#B9782D]",
                      ].join(" ")}
                    >
                      {period.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Average Likes"
              value={formatNumber(performance.avgLikes)}
              tint="text-rose-500"
              icon={<Heart className="h-5 w-5" />}
            />

            <MetricCard
              label="Average Comments"
              value={formatNumber(performance.avgComments)}
              tint="text-emerald-500"
              icon={<MessageCircle className="h-5 w-5" />}
            />

            <MetricCard
              label="Average Shares"
              value={formatNumber(performance.avgShares)}
              tint="text-indigo-500"
              icon={<Share2 className="h-5 w-5" />}
            />

            <MetricCard
              label="Average Saves"
              value={formatNumber(performance.avgSaves)}
              tint="text-amber-500"
              icon={<Bookmark className="h-5 w-5" />}
            />

            <MetricCard
              label="Average Reposts"
              value={formatNumber(performance.avgReposts)}
              tint="text-violet-500"
              icon={<Repeat2 className="h-5 w-5" />}
            />

            {/* Database fixed metrics */}
            <MetricCard
              label="Average Views"
              value={formatNumber(performance.avgViews)}
              tint="text-sky-500"
              icon={<Eye className="h-5 w-5" />}
            />

            <MetricCard
              label="Average Brand Views"
              value={formatNumber(profile.averageViewBrand)}
              tint="text-blue-500"
              icon={<Eye className="h-5 w-5" />}
            />

            {/* Database metrics */}

            <MetricCard
              label="ER by Followers"
              value={`${performance.erFollowers.toFixed(2)}%`}
              tint="text-teal-500"
              icon={<TrendingUp className="h-5 w-5" />}
              info="
Formula:

(avg likes + avg comments + avg shares + avg saves + avg reposts)
÷ followers × 100

Calculation follows the selected period.
"
            />

            <MetricCard
              label="ER by Views"
              value={`${performance.erViews.toFixed(2)}%`}
              tint="text-cyan-500"
              icon={<Eye className="h-5 w-5" />}
              info="
Formula:

(avg likes + avg comments + avg shares + avg saves + avg reposts)
÷ avg views × 100

Calculation only uses content that has view data.

Only video/reels posts with available views
inside the selected period are used.
"
            />

            <MetricCard
              label="ER by TalentHub"
              value={`${performance.erTalenthub.toFixed(2)}%`}
              tint="text-orange-500"
              icon={<Target className="h-5 w-5" />}
              info="
Formula:
(avg likes + avg comments + avg shares + avg saves + avg views + avg reposts)
÷ followers
The calculation is not multiplied by 100.
Calculation follows the selected period.
"
            />

            <MetricCard
              label="Total Posts benchmarking"
              value={formatNumber(performancePosts.length)}
              tint="text-indigo-500"
              icon={<Users className="h-5 w-5" />}
            />
          </div>

          {profile.lastScrapedAt ? (
            <p className="mt-4 flex items-center gap-1 text-xs text-emerald-500">
              ✓ Last Updated: {formatDate(profile.lastScrapedAt)}
            </p>
          ) : null}
        </section>

        {/* Content — hashtags & mentions moved in here, full width so thumbnails can be bigger */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-8">
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
            📊 Content
          </h2>

          <div className="grid gap-6 xl:grid-cols-2">
            <TagListCard
              title={`Top ${profile.topHashtags.length} Hashtags`}
              items={profile.topHashtags.map(
                (h: { tag: string; count: number }) => h.tag
              )}
              variant="hashtag"
            />
            <TagListCard
              title={`Top ${profile.topMentions.length} Mentions`}
              items={profile.topMentions.map(
                (m: { mention: string; count: number }) => m.mention
              )}
              variant="mention"
            />
          </div>

          {profile.lastScrapedAt ? (
            <p className="mt-4 flex items-center gap-1 text-xs text-emerald-500">
              ✓ Last Updated: {formatDate(profile.lastScrapedAt)}
            </p>
          ) : null}

          <div className="mt-10">
            <h3 className="mb-1 text-xl font-bold">Top 5 Contents</h3>
            <p className="mb-5 text-sm text-slate-400">
              {performancePeriod === "all"
                ? "Top content from all stored posts"
                : `Top content from the last ${performancePeriod} days`}
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {topPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  profilePhotoUrl={profile.photoUrl}
                />
              ))}
              {topPosts.length === 0 ? (
                <p className="col-span-full py-8 text-center italic text-slate-400">
                  No posts available for this creator yet.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </DefaultLayout>
  );
}
