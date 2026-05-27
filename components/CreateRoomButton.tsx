"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";

export function CreateRoomButton() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  function createRoom() {
    setIsCreating(true);
    const roomId = crypto.randomUUID();
    router.push(`/room/${roomId}`);
  }

  return (
    <button
      type="button"
      onClick={createRoom}
      disabled={isCreating}
      className="inline-flex min-h-12 w-fit items-center gap-3 rounded-[8px] bg-slate-950 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
    >
      <Video aria-hidden="true" className="h-5 w-5" />
      {isCreating ? "Creating room..." : "Create room"}
    </button>
  );
}
