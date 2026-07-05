"use client";

import { Empty } from "@tailored-tech/ui/components/empty";
import { Skeleton } from "@tailored-tech/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { trpc } from "@/utils/trpc";

import { Breadcrumbs } from "./breadcrumbs";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { ExplorerToolbar } from "./explorer-toolbar";
import { FileItem } from "./file-item";
import { FileUploader } from "./file-uploader";
import { FolderItem } from "./folder-item";
import { PdfViewerDialog } from "./pdf-viewer-dialog";
import { RenameDialog } from "./rename-dialog";

type Target = { id: string; name: string } | null;
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
  const [renameFolder, setRenameFolder] = useState<Target>(null);
  const [deleteFolder, setDeleteFolder] = useState<Target>(null);
  const [renameFile, setRenameFile] = useState<Target>(null);
  const [deleteFile, setDeleteFile] = useState<Target>(null);
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
                setDeleteFolder({ id: folder.id, name: folder.name })
              }
              onRename={() =>
                setRenameFolder({ id: folder.id, name: folder.name })
              }
            />
          ))}
          {contents.files.map((file) => (
            <FileItem
              key={file.id}
              name={file.name}
              onDelete={() => setDeleteFile({ id: file.id, name: file.name })}
              onOpen={() =>
                setViewFile({ name: file.name, blobUrl: file.blobUrl })
              }
              onRename={() => setRenameFile({ id: file.id, name: file.name })}
            />
          ))}
        </div>
      ) : null}

      <RenameDialog
        kind="folder"
        onOpenChange={(next) => !next && setRenameFolder(null)}
        target={renameFolder}
      />
      <DeleteConfirmDialog
        kind="folder"
        onOpenChange={(next) => !next && setDeleteFolder(null)}
        target={deleteFolder}
      />
      <RenameDialog
        kind="file"
        onOpenChange={(next) => !next && setRenameFile(null)}
        target={renameFile}
      />
      <DeleteConfirmDialog
        kind="file"
        onOpenChange={(next) => !next && setDeleteFile(null)}
        target={deleteFile}
      />
      <PdfViewerDialog
        file={viewFile}
        onOpenChange={(next) => !next && setViewFile(null)}
      />
    </main>
  );
}
