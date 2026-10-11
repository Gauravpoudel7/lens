/** Shown only when `verifiedView(...).badge` is true: an active listing whose fresh check is LOW. */
export function CheckedBadge({ mock }: { mock: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-low/40 bg-low-bg px-3 py-1 text-sm font-medium text-low">
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Checked by Lens{mock ? " (mock data)" : ""}
    </span>
  );
}
