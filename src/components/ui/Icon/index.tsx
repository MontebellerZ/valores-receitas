import type { ReactNode } from "react";

export default function Icon({
  name,
  size = 18,
}: {
  name:
    | "overview"
    | "recipe"
    | "market"
    | "upload"
    | "plus"
    | "trash"
    | "download"
    | "arrow"
    | "check"
    | "package"
    | "chart"
    | "wallet"
    | "search"
    | "edit"
    | "editPurchase"
    | "decrease"
    | "close";
  size?: number;
}) {
  const paths: Record<typeof name, ReactNode> = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    recipe: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" />
        <path d="M4 5.5V21m4-13h8m-8 4h8" />
      </>
    ),
    market: (
      <>
        <path d="M3 3h2l2.2 11.1a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.4L22 7H6" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m-4 4 4-4 4 4" />
        <path d="M4 16v4h16v-4" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16m-10 4v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" />
      </>
    ),
    download: (
      <>
        <path d="M12 4v12m-4-4 4 4 4-4" />
        <path d="M4 18v3h16v-3" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    edit: <><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></>,
    editPurchase: <><rect x="3" y="3" width="11" height="5" rx="1" /><path d="M3 12h5m-5 5h3m5 4 4-1 7-7-3-3-7 7z" /></>,
    decrease: <><path d="M5 12h14" /><circle cx="12" cy="12" r="9" /></>,
    package: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="M3 8v9l9 5 9-5V8M12 13v9" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5m0 14h17" />
        <path d="m7 15 4-4 3 2 6-7" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M3 8h18m-5 6h2M7 5V3h11" />
      </>
    ),
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4 4" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
