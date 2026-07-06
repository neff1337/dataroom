"use client";

import { Empty } from "@tailored-tech/ui/components/empty";
import { Skeleton } from "@tailored-tech/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CreateDataroomDialog } from "@/app/(home)/_components/create-dataroom-dialog";
import { DataroomCard } from "@/app/(home)/_components/dataroom-card";
import {
  DeleteConfirmDialog,
  type DeleteTarget,
} from "@/components/shared/delete-confirm-dialog";
import {
  RenameDialog,
  type RenameTarget,
} from "@/components/shared/rename-dialog";
import { trpc } from "@/utils/trpc";

export default function DataroomHome() {
  const roomsQuery = useQuery(trpc.dataroom.list.queryOptions());
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const rooms = roomsQuery.data;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-semibold text-2xl">Data Rooms</h1>
        <CreateDataroomDialog />
      </div>

      {roomsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : null}

      {rooms && rooms.length === 0 ? (
        <Empty>
          <p className="text-muted-foreground text-sm">
            No data rooms yet. Create your first one to start uploading
            documents.
          </p>
        </Empty>
      ) : null}

      {rooms && rooms.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <DataroomCard
              fileCount={room._count.files}
              folderCount={room._count.folders}
              id={room.id}
              key={room.id}
              name={room.name}
              onDelete={() =>
                setDeleteTarget({
                  id: room.id,
                  name: room.name,
                  kind: "dataroom",
                })
              }
              onRename={() =>
                setRenameTarget({
                  id: room.id,
                  name: room.name,
                  kind: "dataroom",
                })
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
    </main>
  );
}
