/**
 * GitHub OAuth helpers shared between the /api/oauth/github callback and the
 * /api/submit route. Tokens are stored in a short-lived httpOnly cookie so
 * the /contribute client never touches the access token directly.
 */
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "divine_gh_token";
const USER_COOKIE = "divine_gh_user";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours — long enough for a writing session

export const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_SCOPES = "public_repo,read:user";

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  created_at: string;
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const qs = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: GITHUB_SCOPES,
    state: params.state,
    allow_signup: "true",
  });
  return `${GITHUB_AUTHORIZE_URL}?${qs.toString()}`;
}

export async function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<string> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!data.access_token) {
    throw new Error(data.error_description || data.error || "No access token returned");
  }

  return data.access_token;
}

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub user fetch failed: ${res.status}`);
  }
  return (await res.json()) as GitHubUser;
}

export function tokenCookieOptions() {
  return {
    name: TOKEN_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export function userCookieOptions() {
  return {
    name: USER_COOKIE,
    httpOnly: false, // readable by client so the UI can show the username
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export function readTokenCookie(req: NextRequest): string | null {
  return req.cookies.get(TOKEN_COOKIE)?.value ?? null;
}

export const TOKEN_COOKIE_NAME = TOKEN_COOKIE;
export const USER_COOKIE_NAME = USER_COOKIE;
