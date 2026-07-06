"use client";

import { Button } from "@tailored-tech/ui/components/button";
import { Progress } from "@tailored-tech/ui/components/progress";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upload } from "@vercel/blob/client";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES } from "@/lib/upload-constants";
import { trpc } from "@/utils/trpc";

export function FileUploader({
  dataroomId,
  folderId,
}: {
  dataroomId: string;
  folderId: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const createFile = useMutation(trpc.file.create.mutationOptions());
  const { data: session } = authClient.useSession();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.folder.contents.queryKey({ dataroomId, folderId }),
    });

  const uploadOne = async (file: File, userId: string) => {
    if (file.type !== ACCEPTED_MIME) {
      toast.error(`${file.name}: only PDF files are allowed`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`${file.name}: exceeds the 50 MB limit`);
      return;
    }
    try {
      setProgress(0);
      const blob = await upload(`${userId}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        contentType: file.type,
        onUploadProgress: (event) => setProgress(event.percentage),
      });
      await createFile.mutateAsync({
        dataroomId,
        folderId,
        name: file.name,
        blobUrl: blob.url,
        blobPathname: blob.pathname,
        size: file.size,
        contentType: ACCEPTED_MIME,
      });
      toast.success(`${file.name} uploaded`);
      invalidate();
    } catch (error) {
      toast.error(`${file.name}: ${(error as Error).message}`);
    } finally {
      setProgress(null);
    }
  };

  const handleFiles = async (files: FileList) => {
    const userId = session?.user.id;
    if (!userId) {
      toast.error("You must be signed in to upload");
      return;
    }
    for (const file of Array.from(files)) {
      await uploadOne(file, userId);
    }
  };

  return (
    <>
      <input
        accept={ACCEPTED_MIME}
        className="hidden"
        multiple
        onChange={(event) => {
          if (event.target.files) {
            handleFiles(event.target.files);
            event.target.value = "";
          }
        }}
        ref={inputRef}
        type="file"
      />
      <Button
        disabled={progress !== null}
        onClick={() => inputRef.current?.click()}
      >
        <Upload />
        {progress === null ? "Upload" : `Uploading ${Math.round(progress)}%`}
      </Button>
      {progress === null ? null : (
        <Progress className="w-24" value={progress} />
      )}
    </>
  );
}
