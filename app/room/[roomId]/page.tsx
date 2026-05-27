import { RoomClient } from "@/components/RoomClient";

type RoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  return <RoomClient roomId={roomId} />;
}
