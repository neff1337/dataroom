"use client";

import { Card } from "@tailored-tech/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tailored-tech/ui/components/dropdown-menu";
import { Folder, MoreVertical } from "lucide-react";
import Link from "next/link";

export function FolderItem({
  dataroomId,
  id,
  name,
  onRename,
  onDelete,
}: {
  dataroomId: string;
  id: string;
  name: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex items-center justify-between gap-2 p-3">
      <Link
        className="flex min-w-0 flex-1 items-center gap-2"
        href={`/rooms/${dataroomId}/folders/${id}`}
      >
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate" title={name}>
          {name}
        </span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="shrink-0 text-muted-foreground hover:text-foreground">
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card">
          <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} variant="destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
