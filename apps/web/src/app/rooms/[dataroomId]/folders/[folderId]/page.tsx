export default async function FolderPage({
  params,
}: {
  params: Promise<{ dataroomId: string; folderId: string }>;
}) {
  const { dataroomId, folderId } = await params;
  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <p className="text-muted-foreground text-sm">
        Room {dataroomId} / Folder {folderId}
      </p>
    </main>
  );
}
