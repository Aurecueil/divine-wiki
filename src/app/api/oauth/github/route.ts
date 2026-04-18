/**
 * GitHub OAuth callback. The /contribute page kicks off the flow by linking to
 *   /api/oauth/github?start=1&return=<path>
 * which redirects the user to GitHub. GitHub sends them back with ?code=...
 * and we exchange it for an access token, set an httpOnly cookie, and bounce
 * back to the originally-requested page.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchGitHubUser,
  tokenCookieOptions,
  userCookieOptions,
} from "@/lib/github-oauth";
import { baseUrl } from "@/lib/config";

const STATE_COOKIE = "divine_gh_oauth_state";
const RETURN_COOKIE = "divine_gh_oauth_return";

function randomState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function callbackUrl() {
  return `${baseUrl.replace(/\/$/, "")}/api/oauth/github`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;

  // Kickoff path: redirect to GitHub.
  if (params.get("start") === "1") {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) {
      return new NextResponse("GitHub OAuth is not configured", { status: 503 });
    }

    const state = randomState();
    const returnTo = params.get("return") || "/en/contribute";
    const authorizeUrl = buildAuthorizeUrl({
      clientId,
      redirectUri: callbackUrl(),
      state,
    });

    const res = NextResponse.redirect(authorizeUrl);
    res.cookies.set({
      name: STATE_COOKIE,
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes to complete the hop
    });
    res.cookies.set({
      name: RETURN_COOKIE,
      value: returnTo,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return res;
  }

  // Callback path: exchange code for token.
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return new NextResponse("Missing code or state", { status: 400 });
  }

  const expectedState = req.cookies.get(STATE_COOKIE)?.value;
  if (!expectedState || expectedState !== state) {
    return new NextResponse("Invalid OAuth state", { status: 400 });
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new NextResponse("GitHub OAuth is not configured", { status: 503 });
  }

  let token: string;
  let user;
  try {
    token = await exchangeCodeForToken({
      clientId,
      clientSecret,
      code,
      redirectUri: callbackUrl(),
    });
    user = await fetchGitHubUser(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    return new NextResponse(`OAuth failed: ${message}`, { status: 502 });
  }

  const returnTo = req.cookies.get(RETURN_COOKIE)?.value || "/en/contribute";
  const res = NextResponse.redirect(`${baseUrl.replace(/\/$/, "")}${returnTo}`);

  const tokenOpts = tokenCookieOptions();
  res.cookies.set({
    ...tokenOpts,
    name: tokenOpts.name,
    value: token,
  });

  const userOpts = userCookieOptions();
  res.cookies.set({
    ...userOpts,
    name: userOpts.name,
    value: JSON.stringify({
      login: user.login,
      avatar: user.avatar_url,
      createdAt: user.created_at,
    }),
  });

  res.cookies.delete(STATE_COOKIE);
  res.cookies.delete(RETURN_COOKIE);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("divine_gh_token");
  res.cookies.delete("divine_gh_user");
  return res;
}
