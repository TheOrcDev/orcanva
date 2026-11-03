import type { EditorAsset } from "@/lib/editor/store";
import type { VersionContent } from "@/lib/versions/content";
import type { VersionSummary } from "@/lib/versions/schema";

// The editor's calls to the version history routes
// (app/api/designs/[id]/versions)

export class VersionRequestError extends Error {
  // The server's answer; null when it couldn't be reached
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "VersionRequestError";
    this.status = status;
  }
}

const errorMessage = async (response: Response): Promise<string> => {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    // Not JSON: fall through to the status
  }
  return `Request failed with ${response.status}`;
};

const send = async (url: string, init?: RequestInit): Promise<Response> => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new VersionRequestError("Couldn't reach the server", null);
  }
  if (!response.ok) {
    throw new VersionRequestError(
      await errorMessage(response),
      response.status
    );
  }
  return response;
};

const versionsUrl = (designId: string) => `/api/designs/${designId}/versions`;

export interface VersionPage {
  versions: VersionSummary[];
  // Pass as `before` for the next page; null on the last
  next: string | null;
}

export const fetchVersions = async (
  designId: string,
  before: string | null = null
): Promise<VersionPage> => {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  const response = await send(`${versionsUrl(designId)}${query}`);
  return response.json();
};

export const saveVersion = async (
  designId: string,
  name: string
): Promise<{ id: string }> => {
  const response = await send(versionsUrl(designId), {
    body: JSON.stringify({ name }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return response.json();
};

// A picture of the version, unless it already has one (409, ignored)
export const uploadVersionThumbnail = async (
  designId: string,
  versionId: string,
  picture: Blob
): Promise<void> => {
  await send(`${versionsUrl(designId)}/${versionId}/thumbnail`, {
    body: picture,
    headers: { "Content-Type": "image/jpeg" },
    method: "PUT",
  });
};

export interface VersionPreviewData {
  version: VersionSummary;
  content: VersionContent;
  // The images it shows that the server has
  assets: EditorAsset[];
}

export const fetchVersion = async (
  designId: string,
  versionId: string
): Promise<VersionPreviewData> => {
  const response = await send(`${versionsUrl(designId)}/${versionId}`);
  return response.json();
};

export const deleteVersion = async (
  designId: string,
  versionId: string
): Promise<void> => {
  await send(`${versionsUrl(designId)}/${versionId}`, { method: "DELETE" });
};
