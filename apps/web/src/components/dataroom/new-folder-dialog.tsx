"use client";

import { Button } from "@tailored-tech/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@tailored-tech/ui/components/dialog";
import { Input } from "@tailored-tech/ui/components/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

export function NewFolderDialog({
  dataroomId,
  parentId,
}: {
  dataroomId: string;
  parentId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    trpc.folder.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.folder.contents.queryKey({
            dataroomId,
            folderId: parentId,
          }),
        });
        toast.success("Folder created");
        setOpen(false);
        setName("");
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const trimmed = name.trim();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FolderPlus />
        New Folder
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) {
              createMutation.mutate({ dataroomId, parentId, name: trimmed });
            }
          }}
        >
          <Input
            autoFocus
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
            placeholder="Financials"
            value={name}
          />
          <DialogFooter className="mt-4">
            <Button
              disabled={!trimmed || createMutation.isPending}
              type="submit"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
