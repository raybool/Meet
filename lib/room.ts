export type RoomRole = "host" | "guest";

export type RoomPresenceMember = {
  clientId: string;
  joinedAt: number;
  lastSeenAt?: number;
};

export type RoomSelection =
  | {
      state: "active";
      role: RoomRole;
      peerId: string | null;
      participantIds: string[];
    }
  | {
      state: "full";
      role: null;
      peerId: null;
      participantIds: string[];
    };

type SelectRoomParticipantOptions = {
  activeMemberTtlMs?: number;
  now?: number;
};

export const ACTIVE_MEMBER_TTL_MS = 45_000;

export function selectRoomParticipant(
  members: RoomPresenceMember[],
  currentClientId: string,
  {
    activeMemberTtlMs = Number.POSITIVE_INFINITY,
    now = Date.now(),
  }: SelectRoomParticipantOptions = {},
): RoomSelection {
  const activeParticipantIds = normalizeMembers(
    members.filter((member) => isMemberActive(member, now, activeMemberTtlMs)),
  ).map((member) => member.clientId);
  const participantIds = activeParticipantIds.includes(currentClientId)
    ? activeParticipantIds
    : [...activeParticipantIds, currentClientId];
  const currentIndex = participantIds.indexOf(currentClientId);

  if (currentIndex > 1) {
    return {
      state: "full",
      role: null,
      peerId: null,
      participantIds,
    };
  }

  const role: RoomRole = currentIndex === 0 ? "host" : "guest";
  const peerId =
    currentIndex === 0 ? participantIds[1] ?? null : participantIds[0] ?? null;

  return {
    state: "active",
    role,
    peerId,
    participantIds,
  };
}

export function normalizeMembers(members: RoomPresenceMember[]) {
  const byClientId = new Map<string, RoomPresenceMember>();

  for (const member of members) {
    const existing = byClientId.get(member.clientId);

    if (!existing || member.joinedAt < existing.joinedAt) {
      byClientId.set(member.clientId, member);
    }
  }

  return [...byClientId.values()].sort((first, second) => {
    if (first.joinedAt !== second.joinedAt) {
      return first.joinedAt - second.joinedAt;
    }

    return first.clientId.localeCompare(second.clientId);
  });
}

function isMemberActive(
  member: RoomPresenceMember,
  now: number,
  activeMemberTtlMs: number,
) {
  const lastSeenAt = member.lastSeenAt ?? member.joinedAt;
  return now - lastSeenAt <= activeMemberTtlMs;
}
