"use client";

import { Card } from "@tailored-tech/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tailored-tech/ui/components/dropdown-menu";
import { FolderOpen, MoreVertical } from "lucide-react";
import Link from "next/link";

interface DataroomCardProps {
  fileCount: number;
  folderCount: number;
  id: string;
  name: string;
  onDelete: () => void;
  onRename: () => void;
}

export function DataroomCard({
  id,
  name,
  folderCount,
  fileCount,
  onRename,
  onDelete,
}: DataroomCardProps) {
  return (
    <Card className="flex items-start justify-between gap-2 p-4">
      <Link
        className="flex min-w-0 flex-1 items-start gap-3"
        href={`/rooms/${id}`}
      >
        <FolderOpen className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{name}</span>
          <span className="text-muted-foreground text-xs">
            {folderCount} folders · {fileCount} files
          </span>
        </span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground">
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
