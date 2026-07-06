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

export interface RenameTarget {
  id: string;
  kind: Kind;
  name: string;
}

interface RenameDialogProps {
  onOpenChange: (open: boolean) => void;
  onRenamed?: () => void;
  target: RenameTarget | null;
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
  target,
  onOpenChange,
  onRenamed,
}: RenameDialogProps) {
  const [name, setName] = useState("");
  // Keep the last non-null target so the dialog can play its exit animation
  // while `target` is already null during close.
  const [active, setActive] = useState(target);
  const queryClient = useQueryClient();
  const mutation = useRenameMutation(active?.kind ?? "file");

  useEffect(() => {
    if (target) {
      setActive(target);
      setName(target.name);
    }
  }, [target]);

  if (!active) {
    return null;
  }

  const trimmed = name.trim();

  const submit = () => {
    mutation.mutate(
      { id: active.id, name: trimmed },
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
          <DialogTitle>Rename {active.kind}</DialogTitle>
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
