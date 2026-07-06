"use client";

import { Empty } from "@tailored-tech/ui/components/empty";
import { Skeleton } from "@tailored-tech/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  DeleteConfirmDialog,
  type DeleteTarget,
} from "@/components/shared/delete-confirm-dialog";
import {
  RenameDialog,
  type RenameTarget,
} from "@/components/shared/rename-dialog";
import { trpc } from "@/utils/trpc";

import { Breadcrumbs } from "./breadcrumbs";
import { ExplorerToolbar } from "./explorer-toolbar";
import { FileItem } from "./file-item";
import { FileUploader } from "./file-uploader";
import { FolderItem } from "./folder-item";
import { PdfViewerDialog } from "./pdf-viewer-dialog";

type ViewFile = { name: string; blobUrl: string } | null;

export function Explorer({
  dataroomId,
  folderId,
}: {
  dataroomId: string;
  folderId: string | null;
}) {
  const contentsQuery = useQuery(
    trpc.folder.contents.queryOptions({ dataroomId, folderId })
  );
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [viewFile, setViewFile] = useState<ViewFile>(null);

  const contents = contentsQuery.data;
  const isEmpty =
    contents && contents.folders.length === 0 && contents.files.length === 0;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Breadcrumbs dataroomId={dataroomId} folderId={folderId} />
        <ExplorerToolbar dataroomId={dataroomId} folderId={folderId}>
          <FileUploader dataroomId={dataroomId} folderId={folderId} />
        </ExplorerToolbar>
      </div>

      {contentsQuery.isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : null}

      {isEmpty ? (
        <Empty>
          <p className="text-muted-foreground text-sm">
            This folder is empty. Create a folder or upload a PDF.
          </p>
        </Empty>
      ) : null}

      {contents && !isEmpty ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {contents.folders.map((folder) => (
            <FolderItem
              dataroomId={dataroomId}
              id={folder.id}
              key={folder.id}
              name={folder.name}
              onDelete={() =>
                setDeleteTarget({
                  id: folder.id,
                  name: folder.name,
                  kind: "folder",
                })
              }
              onRename={() =>
                setRenameTarget({
                  id: folder.id,
                  name: folder.name,
                  kind: "folder",
                })
              }
            />
          ))}
          {contents.files.map((file) => (
            <FileItem
              key={file.id}
              name={file.name}
              onDelete={() =>
                setDeleteTarget({ id: file.id, name: file.name, kind: "file" })
              }
              onOpen={() =>
                setViewFile({ name: file.name, blobUrl: file.blobUrl })
              }
              onRename={() =>
                setRenameTarget({ id: file.id, name: file.name, kind: "file" })
              }
            />
          ))}
        </div>
      ) : null}

      <RenameDialog
        onOpenChange={(next) => {
          if (!next) {
            setRenameTarget(null);
          }
        }}
        target={renameTarget}
      />
      <DeleteConfirmDialog
        onOpenChange={(next) => {
          if (!next) {
            setDeleteTarget(null);
          }
        }}
        target={deleteTarget}
      />
      <PdfViewerDialog
        file={viewFile}
        onOpenChange={(next) => {
          if (!next) {
            setViewFile(null);
          }
        }}
      />
    </main>
  );
}
