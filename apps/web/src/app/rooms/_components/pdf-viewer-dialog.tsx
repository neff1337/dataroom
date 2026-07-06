"use client";

import { Button, buttonVariants } from "@tailored-tech/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@tailored-tech/ui/components/dialog";
import { cn } from "@tailored-tech/ui/lib/utils";
import { Download, ExternalLink, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

export function PdfViewerDialog({
  file,
  onOpenChange,
}: {
  file: { name: string; blobUrl: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  // Keep the last non-null file so the dialog can play its exit animation
  // while `file` is already null during close.
  const [active, setActive] = useState(file);

  useEffect(() => {
    if (file) {
      setActive(file);
    }
  }, [file]);

  if (!active) {
    return null;
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(file)}>
      <DialogContent
        className="grid h-[85vh] w-[90vw] grid-rows-[auto_1fr] sm:max-w-4xl"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between gap-2">
          <DialogTitle className="truncate">{active.name}</DialogTitle>
          <div className="flex items-center gap-2">
            <a
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              href={active.blobUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink />
              Open
            </a>
            <a
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              download={active.name}
              href={active.blobUrl}
            >
              <Download />
              Download
            </a>
            <DialogClose
              data-slot="dialog-close"
              render={<Button size="icon-sm" variant="outline" />}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </DialogHeader>
        <iframe
          className="h-full w-full border-0 bg-white"
          src={active.blobUrl}
          title={active.name}
        />
      </DialogContent>
    </Dialog>
  );
}
