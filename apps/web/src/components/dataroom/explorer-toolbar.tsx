"use client";

import type * as React from "react";

import { NewFolderDialog } from "./new-folder-dialog";

export function ExplorerToolbar({
  dataroomId,
  folderId,
  children,
}: {
  dataroomId: string;
  folderId: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <NewFolderDialog dataroomId={dataroomId} parentId={folderId} />
      {children}
    </div>
  );
}
