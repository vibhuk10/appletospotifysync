"use client";

import type { ArtistBuildResult } from "@/lib/types";

interface Props {
  results: ArtistBuildResult[];
  currentIndex: number;
  total: number;
  done: boolean;
  onReset?: () => void;
}

export default function ArtistBuildProgress({
  results,
  currentIndex,
  total,
  done,
  onReset,
}: Props) {
  const completedCount = results.filter(
    (r) => r.status === "done" || r.status === "error"
  ).length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const created = results.filter((r) => r.status === "done" && r.created).length;
  const updated = results.filter((r) => r.status === "done" && !r.created).length;
  const totalAdded = results.reduce(
    (sum, r) => (r.status === "done" ? sum + r.added : sum),
    0
  );
  const errors = results.filter((r) => r.status === "error").length;

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-3">
        {!done ? (
          <span className="inline-block h-4 w-4 rounded-full border-2 border-muted/30 border-t-spotify-green animate-spin" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-spotify-green/20">
            <svg className="h-3 w-3 text-spotify-green" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
        )}
        <p className="text-sm font-medium text-foreground">
          {done ? "Done" : `Building playlists… (${currentIndex + 1} / ${total})`}
        </p>
      </div>

      <div className="h-1.5 w-full rounded-full bg-card overflow-hidden">
        <div
          className="h-full bg-spotify-green transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {done && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-card-border bg-card/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-lg font-heading font-semibold text-foreground">{created}</p>
          </div>
          <div className="rounded-xl border border-card-border bg-card/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Updated</p>
            <p className="text-lg font-heading font-semibold text-foreground">{updated}</p>
          </div>
          <div className="rounded-xl border border-card-border bg-card/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Tracks added</p>
            <p className="text-lg font-heading font-semibold text-foreground">{totalAdded}</p>
          </div>
          <div className="rounded-xl border border-card-border bg-card/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Errors</p>
            <p className="text-lg font-heading font-semibold text-foreground">{errors}</p>
          </div>
        </div>
      )}

      <ul className="max-h-80 overflow-y-auto rounded-xl border border-card-border bg-card/30 divide-y divide-card-border">
        {results.map((r) => (
          <li
            key={r.artist.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <StatusDot status={r.status} />
              <span className="text-sm text-foreground truncate">{r.artist.name}</span>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {r.status === "done"
                ? `${r.created ? "created" : "updated"} · +${r.added}${r.skipped ? ` · ${r.skipped} already there` : ""}`
                : r.status === "error"
                ? r.error || "error"
                : r.status === "building"
                ? "working…"
                : `${r.artist.trackCount} songs`}
            </span>
          </li>
        ))}
      </ul>

      {done && onReset && (
        <button
          onClick={onReset}
          className="w-full rounded-xl py-3 font-heading font-semibold text-foreground bg-card hover:bg-card/70 border border-card-border focus:outline-none focus:ring-2 focus:ring-muted/30"
        >
          Start over
        </button>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: ArtistBuildResult["status"] }) {
  const cls =
    status === "done"
      ? "bg-spotify-green"
      : status === "error"
      ? "bg-apple-red"
      : status === "building"
      ? "bg-foreground animate-pulse"
      : "bg-muted/30";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}
