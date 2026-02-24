"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { exchangeCodeForToken } from "@/lib/spotify";
import { Suspense } from "react";
import Link from "next/link";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const code = searchParams.get("code");
  const [error, setError] = useState<string | null>(
    authError
      ? `Spotify authorization denied: ${authError}`
      : !code
        ? "No authorization code received"
        : null
  );

  useEffect(() => {
    if (!code || error) return;
    let cancelled = false;
    exchangeCodeForToken(code)
      .then(() => {
        if (!cancelled) router.replace("/");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to exchange token");
      });
    return () => { cancelled = true; };
  }, [code, error, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-500 text-lg">{error}</p>
          <Link href="/" className="text-blue-500 underline">
            Go back and try again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-400">Connecting to Spotify...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-400">Loading...</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
