import { auth } from "@tailored-tech/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <h1 className="font-semibold text-2xl">Data Rooms</h1>
    </main>
  );
}
