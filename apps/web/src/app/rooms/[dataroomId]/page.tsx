export default async function RoomPage({
  params,
}: {
  params: Promise<{ dataroomId: string }>;
}) {
  const { dataroomId } = await params;
  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <p className="text-muted-foreground text-sm">Room {dataroomId}</p>
    </main>
  );
}
