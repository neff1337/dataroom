"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { trpc } from "@/utils/trpc";

export function Breadcrumbs({
  dataroomId,
  folderId,
}: {
  dataroomId: string;
  folderId: string | null;
}) {
  const breadcrumbQuery = useQuery({
    ...trpc.folder.breadcrumb.queryOptions({ folderId: folderId ?? "" }),
    enabled: folderId !== null,
  });

  return (
    <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
      <Link
        className="text-muted-foreground hover:text-foreground"
        href={`/rooms/${dataroomId}`}
      >
        Root
      </Link>
      {(breadcrumbQuery.data ?? []).map((crumb) => (
        <span className="flex min-w-0 items-center gap-1" key={crumb.id}>
          <span className="text-muted-foreground">/</span>
          <Link
            className="max-w-40 truncate text-muted-foreground hover:text-foreground"
            href={`/rooms/${dataroomId}/folders/${crumb.id}`}
          >
            {crumb.name}
          </Link>
        </span>
      ))}
    </nav>
  );
}
