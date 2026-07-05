"use client";

import { Card } from "@tailored-tech/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tailored-tech/ui/components/dropdown-menu";
import { FileText, MoreVertical } from "lucide-react";

export function FileItem({
  name,
  onOpen,
  onRename,
  onDelete,
}: {
  name: string;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex items-center justify-between gap-2 p-3">
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={onOpen}
        type="button"
      >
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate" title={name}>
          {name}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger className="shrink-0 text-muted-foreground hover:text-foreground">
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card">
          <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} variant="destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
