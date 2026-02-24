"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { exchangeCodeForToken } from "@/lib/spotify";
import { Suspense } from "react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const authError = searchParams.get("error");

    if (authError) {
      setError(`Spotify authorization denied: ${authError}`);
      return;
    }

    if (!code) {
      setError("No authorization code received");
      return;
    }

    exchangeCodeForToken(code)
      .then(() => {
        router.replace("/");
      })
      .catch((err) => {
        setError(err.message || "Failed to exchange token");
      });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-500 text-lg">{error}</p>
          <a href="/" className="text-blue-500 underline">
            Go back and try again
          </a>
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
