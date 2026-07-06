import { Explorer } from "@/app/rooms/_components/explorer";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ dataroomId: string; folderId: string }>;
}) {
  const { dataroomId, folderId } = await params;
  return <Explorer dataroomId={dataroomId} folderId={folderId} />;
}
