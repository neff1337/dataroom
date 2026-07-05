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
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

type Kind = "dataroom" | "folder" | "file";

interface DeleteConfirmDialogProps {
  kind: Kind;
  onDeleted?: () => void;
  onOpenChange: (open: boolean) => void;
  target: { id: string; name: string } | null;
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
  kind,
  target,
  onOpenChange,
  onDeleted,
}: DeleteConfirmDialogProps) {
  const queryClient = useQueryClient();
  const mutation = useRemoveMutation(kind);

  if (!target) {
    return null;
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={Boolean(target)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{target.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {RECURSIVE_WARNING[kind]} This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { id: target.id },
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
