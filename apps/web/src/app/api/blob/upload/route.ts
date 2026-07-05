import { auth } from "@tailored-tech/auth";
import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { ACCEPTED_MIME, MAX_UPLOAD_BYTES } from "@/lib/upload-constants";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth.api.getSession({
          headers: await headers(),
        });
        if (!session?.user) {
          throw new Error("Unauthorized");
        }
        return {
          allowedContentTypes: [ACCEPTED_MIME],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
      // No-op: the DB row is created by the client via trpc.file.create,
      // so this works on localhost where Blob cannot call back.
      onUploadCompleted: () => Promise.resolve(),
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
