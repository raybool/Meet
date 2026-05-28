import { RoomClient } from "@/components/RoomClient";

type RoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const { roomId } = await params;
  const { token } = await searchParams;

  return <RoomClient inviteToken={token ?? ""} roomId={roomId} />;
}
