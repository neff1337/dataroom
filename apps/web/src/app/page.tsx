import { auth } from "@tailored-tech/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DataroomHome } from "@/components/dataroom/dataroom-home";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  return <DataroomHome />;
}
