"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";

type ExchangeResponse = {
  roomPath: string;
};

export function JoinClient() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function exchangeInvite() {
      const code = readInviteCodeFromHash();
      window.history.replaceState(null, "", window.location.pathname);

      if (!code) {
        if (!cancelled) {
          setError("Invite link is invalid or expired.");
        }
        return;
      }

      try {
        const response = await fetch("/api/invites/exchange", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          throw new Error("Invite link is invalid or expired.");
        }

        const { roomPath } = (await response.json()) as ExchangeResponse;

        if (!cancelled) {
          router.replace(roomPath);
        }
      } catch {
        if (!cancelled) {
          setError("Invite link is invalid or expired.");
        }
      }
    }

    void exchangeInvite();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef4f1] px-4 text-slate-950">
      <section className="w-full max-w-md rounded-[8px] border border-slate-200 bg-white p-6 text-center shadow-sm">
        <Link2 aria-hidden="true" className="mx-auto h-8 w-8 text-emerald-800" />
        <h1 className="mt-4 text-xl font-semibold">
          {error ? "Invite unavailable" : "Opening room"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {error ?? "Preparing secure room access..."}
        </p>
      </section>
    </main>
  );
}

function readInviteCodeFromHash() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  return params.get("code");
}
