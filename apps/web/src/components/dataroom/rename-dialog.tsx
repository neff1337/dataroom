"use client";

import { Button } from "@tailored-tech/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@tailored-tech/ui/components/dialog";
import { Input } from "@tailored-tech/ui/components/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

type Kind = "dataroom" | "folder" | "file";

interface RenameDialogProps {
  kind: Kind;
  onOpenChange: (open: boolean) => void;
  onRenamed?: () => void;
  target: { id: string; name: string } | null;
}

function useRenameMutation(kind: Kind) {
  const dataroom = useMutation(trpc.dataroom.rename.mutationOptions());
  const folder = useMutation(trpc.folder.rename.mutationOptions());
  const file = useMutation(trpc.file.rename.mutationOptions());
  if (kind === "dataroom") {
    return dataroom;
  }
  if (kind === "folder") {
    return folder;
  }
  return file;
}

export function RenameDialog({
  kind,
  target,
  onOpenChange,
  onRenamed,
}: RenameDialogProps) {
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const mutation = useRenameMutation(kind);

  useEffect(() => {
    setName(target?.name ?? "");
  }, [target]);

  if (!target) {
    return null;
  }

  const trimmed = name.trim();

  const submit = () => {
    mutation.mutate(
      { id: target.id, name: trimmed },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast.success("Renamed");
          onRenamed?.();
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(target)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {kind}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) {
              submit();
            }
          }}
        >
          <Input
            autoFocus
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <DialogFooter className="mt-4">
            <Button disabled={!trimmed || mutation.isPending} type="submit">
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
