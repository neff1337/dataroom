import { TRPCError } from "@trpc/server";

import type { Context } from "../context";

type Db = Context["db"];

export async function assertDataroomOwner(
  db: Db,
  userId: string,
  dataroomId: string
) {
  const dataroom = await db.dataroom.findUnique({ where: { id: dataroomId } });
  if (!dataroom) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Data room not found" });
  }
  if (dataroom.ownerId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your data room" });
  }
  return dataroom;
}

export async function assertFolderOwner(
  db: Db,
  userId: string,
  folderId: string
) {
  const folder = await db.folder.findUnique({
    where: { id: folderId },
    include: { dataroom: true },
  });
  if (!folder) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
  }
  if (folder.dataroom.ownerId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your folder" });
  }
  return folder;
}

export async function assertFileOwner(db: Db, userId: string, fileId: string) {
  const file = await db.file.findUnique({
    where: { id: fileId },
    include: { dataroom: true },
  });
  if (!file) {
    throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
  }
  if (file.dataroom.ownerId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your file" });
  }
  return file;
}
