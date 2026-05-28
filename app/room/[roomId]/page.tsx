import { cookies } from "next/headers";
import { RoomClient } from "@/components/RoomClient";
import {
  readRoomAccessCookie,
  validateRoomCookieAccess,
} from "@/lib/access";

type RoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  const cookieStore = await cookies();
  const access = validateRoomCookieAccess({
    roomId,
    token: readRoomAccessCookie({
      cookies: cookieStore,
      roomId,
    }),
    secret: process.env.INVITE_SIGNING_SECRET,
  });

  return <RoomClient hasRoomAccess={access.ok} roomId={roomId} />;
}
