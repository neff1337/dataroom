import type { Context } from "../context";

type Db = Context["db"];

/** Recursively collect blobPathname of every file under `folderId` (inclusive). */
export async function collectFolderBlobPathnames(
  db: Db,
  folderId: string
): Promise<string[]> {
  const [files, childFolders] = await Promise.all([
    db.file.findMany({ where: { folderId }, select: { blobPathname: true } }),
    db.folder.findMany({ where: { parentId: folderId }, select: { id: true } }),
  ]);
  const pathnames = files.map((file) => file.blobPathname);
  for (const child of childFolders) {
    pathnames.push(...(await collectFolderBlobPathnames(db, child.id)));
  }
  return pathnames;
}

/** Collect blobPathname of every file in the whole data room. */
export async function collectDataroomBlobPathnames(
  db: Db,
  dataroomId: string
): Promise<string[]> {
  const files = await db.file.findMany({
    where: { dataroomId },
    select: { blobPathname: true },
  });
  return files.map((file) => file.blobPathname);
}
