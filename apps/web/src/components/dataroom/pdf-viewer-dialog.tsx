"use client";

import { buttonVariants } from "@tailored-tech/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@tailored-tech/ui/components/dialog";
import { cn } from "@tailored-tech/ui/lib/utils";
import { Download, ExternalLink } from "lucide-react";

export function PdfViewerDialog({
  file,
  onOpenChange,
}: {
  file: { name: string; blobUrl: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!file) {
    return null;
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(file)}>
      <DialogContent className="grid h-[85vh] w-[90vw] max-w-4xl grid-rows-[auto_1fr]">
        <DialogHeader className="flex-row items-center justify-between gap-2 pr-8">
          <DialogTitle className="truncate">{file.name}</DialogTitle>
          <div className="flex items-center gap-2">
            <a
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              href={file.blobUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink />
              Open
            </a>
            <a
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              download={file.name}
              href={file.blobUrl}
            >
              <Download />
              Download
            </a>
          </div>
        </DialogHeader>
        <iframe
          className="h-full w-full border-0 bg-white"
          src={file.blobUrl}
          title={file.name}
        />
      </DialogContent>
    </Dialog>
  );
}
