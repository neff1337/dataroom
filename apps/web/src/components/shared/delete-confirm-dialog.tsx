"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@tailored-tech/ui/components/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

type Kind = "dataroom" | "folder" | "file";

export interface DeleteTarget {
  id: string;
  kind: Kind;
  name: string;
}

interface DeleteConfirmDialogProps {
  onDeleted?: () => void;
  onOpenChange: (open: boolean) => void;
  target: DeleteTarget | null;
}

const RECURSIVE_WARNING: Record<Kind, string> = {
  dataroom: "This deletes the data room and all its folders and files.",
  folder: "This deletes the folder and everything inside it.",
  file: "This permanently deletes the file.",
};

function useRemoveMutation(kind: Kind) {
  const dataroom = useMutation(trpc.dataroom.remove.mutationOptions());
  const folder = useMutation(trpc.folder.remove.mutationOptions());
  const file = useMutation(trpc.file.remove.mutationOptions());
  if (kind === "dataroom") {
    return dataroom;
  }
  if (kind === "folder") {
    return folder;
  }
  return file;
}

export function DeleteConfirmDialog({
  target,
  onOpenChange,
  onDeleted,
}: DeleteConfirmDialogProps) {
  const queryClient = useQueryClient();
  // Keep the last non-null target so the dialog can play its exit animation
  // while `target` is already null during close.
  const [active, setActive] = useState(target);
  const mutation = useRemoveMutation(active?.kind ?? "file");

  useEffect(() => {
    if (target) {
      setActive(target);
    }
  }, [target]);

  if (!active) {
    return null;
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={Boolean(target)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{active.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {RECURSIVE_WARNING[active.kind]} This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { id: active.id },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries();
                    toast.success("Deleted");
                    onDeleted?.();
                    onOpenChange(false);
                  },
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          >
            {mutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
