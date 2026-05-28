"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";

export function CreateRoomButton() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const { roomPath } = (await response.json()) as { roomPath: string };
      router.push(roomPath);
    } catch (createError) {
      setError(toErrorMessage(createError));
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={createRoom}
        disabled={isCreating}
        className="inline-flex min-h-12 w-fit items-center gap-3 rounded-[8px] bg-slate-950 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
      >
        <Video aria-hidden="true" className="h-5 w-5" />
        {isCreating ? "Creating room..." : "Create room"}
      </button>

      {error && (
        <p className="max-w-xl rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to create a secure invite link.";
}
