import { auth } from "@tailored-tech/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Explorer } from "@/components/dataroom/explorer";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ dataroomId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  const { dataroomId } = await params;
  return <Explorer dataroomId={dataroomId} folderId={null} />;
}
