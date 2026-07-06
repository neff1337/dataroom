import { Explorer } from "@/app/rooms/_components/explorer";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ dataroomId: string }>;
}) {
  const { dataroomId } = await params;
  return <Explorer dataroomId={dataroomId} folderId={null} />;
}
