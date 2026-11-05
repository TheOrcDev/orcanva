import { z } from "zod";

// The contributors page, after videorc.com/contributors: everyone GitHub
// counts as a contributor to the Orcanva repo, most contributions first. The
// page is static and fetches the list again at most once an hour, so a new
// contributor shows up without a deploy.

export const CONTRIBUTORS_PATH = "/contributors";

// How often, in seconds, the page asks GitHub again. The page's own
// `revalidate` must be a literal, so keep it in step.
export const CONTRIBUTORS_REVALIDATE_SECONDS = 3600;

const CONTRIBUTORS_API_URL =
  "https://api.github.com/repos/TheOrcDev/orcanva/contributors?per_page=100";

// GitHub's avatar CDN sizes the picture itself, so it skips next/image's
// optimizer: twice the card's 48px for sharp screens
const AVATAR_PIXELS = 96;

export interface Contributor {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
}

const contributorSchema = z.object({
  avatar_url: z.url(),
  contributions: z.number().int().nonnegative(),
  html_url: z.url(),
  login: z.string().min(1),
});

// Skips any entry that isn't a whole contributor rather than losing them all
export const parseContributors = (data: unknown): Contributor[] => {
  if (!Array.isArray(data)) {
    return [];
  }
  const contributors: Contributor[] = [];
  for (const entry of data) {
    const parsed = contributorSchema.safeParse(entry);
    if (parsed.success) {
      const { avatar_url, contributions, html_url, login } = parsed.data;
      contributors.push({
        avatarUrl: avatar_url,
        contributions,
        login,
        profileUrl: html_url,
      });
    }
  }
  return contributors.toSorted((a, b) => b.contributions - a.contributions);
};

export const totalContributions = (
  contributors: readonly Contributor[]
): number =>
  contributors.reduce((sum, contributor) => sum + contributor.contributions, 0);

export const formatContributions = (count: number): string =>
  `${count.toLocaleString("en-US")} ${count === 1 ? "contribution" : "contributions"}`;

export const avatarSrc = (avatarUrl: string): string => {
  const url = new URL(avatarUrl);
  url.searchParams.set("s", String(AVATAR_PIXELS));
  return url.href;
};

// Empty when GitHub can't be reached or limits the rate, so the page shows
// a note instead of failing the build. A GITHUB_TOKEN raises GitHub's limit
// from 60 requests an hour per address, which Vercel's servers share.
export const fetchContributors = async (): Promise<Contributor[]> => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const response = await fetch(CONTRIBUTORS_API_URL, {
      headers,
      next: { revalidate: CONTRIBUTORS_REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      return [];
    }
    return parseContributors(await response.json());
  } catch {
    return [];
  }
};
