import type {
  CommentPatch,
  DesignComment,
  MentionPerson,
  NewComment,
} from "@/lib/comments/schema";

// The editor's calls to the comment routes (app/api/designs/[id]/comments)

export class CommentRequestError extends Error {
  // The server's answer; null when it couldn't be reached
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "CommentRequestError";
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
    throw new CommentRequestError("Couldn't reach the server", null);
  }
  if (!response.ok) {
    throw new CommentRequestError(
      await errorMessage(response),
      response.status
    );
  }
  return response;
};

const commentsUrl = (designId: string) => `/api/designs/${designId}/comments`;

const jsonBody = (body: unknown, method: string): RequestInit => ({
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json" },
  method,
});

// A new thread or a reply; resolves with the stored comment
export const postComment = async (
  designId: string,
  comment: NewComment
): Promise<DesignComment> => {
  const response = await send(commentsUrl(designId), jsonBody(comment, "POST"));
  const { comment: stored }: { comment: DesignComment } = await response.json();
  return stored;
};

const commentUrl = (designId: string, commentId: string) =>
  `${commentsUrl(designId)}/${commentId}`;

// New text, or resolving and reopening a thread; resolves with the comment
export const patchComment = async (
  designId: string,
  commentId: string,
  patch: CommentPatch
): Promise<DesignComment> => {
  const response = await send(
    commentUrl(designId, commentId),
    jsonBody(patch, "PATCH")
  );
  const { comment }: { comment: DesignComment } = await response.json();
  return comment;
};

// Deletes a comment; a thread's replies go with it
export const deleteComment = async (
  designId: string,
  commentId: string
): Promise<void> => {
  await send(commentUrl(designId, commentId), { method: "DELETE" });
};

// Who comments on the design can mention (the owner and members only)
export const fetchMentionable = async (
  designId: string
): Promise<MentionPerson[]> => {
  const response = await send(`/api/designs/${designId}/people`);
  const { people }: { people: MentionPerson[] } = await response.json();
  return people;
};
