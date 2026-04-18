/**
 * Image upload endpoint. v1 stores images directly on the contributor's fork
 * under `public/wiki-images/<slug>-<hash>.<ext>`. That keeps the submission
 * flow self-contained (no R2 credentials on the wiki side yet) — the trade-
 * off is that accepted PRs end up committing binaries to the wiki repo. As
 * soon as R2 signed-upload URLs are wired in, this endpoint will issue a
 * pre-signed PUT URL instead and the editor will upload directly to R2.
 */
import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { readTokenCookie, fetchGitHubUser } from "@/lib/github-oauth";

const UPSTREAM_REPO = "divine-wiki";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function sanitizeStem(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "image";
}

function extForType(type: string): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export async function POST(req: NextRequest) {
  const token = readTokenCookie(req);
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File must be between 0 and ${MAX_BYTES} bytes` },
      { status: 413 },
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPG, WebP, and GIF are allowed" },
      { status: 415 },
    );
  }

  const user = await fetchGitHubUser(token).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Invalid GitHub session" }, { status: 401 });
  }

  const stem = sanitizeStem(file.name);
  const ext = extForType(file.type);
  const hash = Math.random().toString(36).slice(2, 10);
  const filename = `${stem}-${hash}.${ext}`;
  const path = `public/wiki-images/${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const octokit = new Octokit({ auth: token });

  // Upload to the contributor's staging branch on their fork. The editor
  // sends images BEFORE the user submits, so we need a stable place to put
  // them. v1: one catch-all `editor-drafts` branch per user; the main
  // submission step cherry-picks the specific images into the actual PR.
  // This is simplistic — a follow-up commit will switch to R2 signed URLs.
  const branch = "editor-drafts";
  try {
    await octokit.repos.get({ owner: user.login, repo: UPSTREAM_REPO });
  } catch {
    return NextResponse.json(
      { error: "Submit a text-only draft first so your fork exists, then retry the image." },
      { status: 409 },
    );
  }

  let existingSha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({
      owner: user.login,
      repo: UPSTREAM_REPO,
      path,
      ref: branch,
    });
    if (!Array.isArray(existing.data) && existing.data.type === "file") {
      existingSha = existing.data.sha;
    }
  } catch {
    /* not found — that's fine */
  }

  try {
    await octokit.repos.createOrUpdateFileContents({
      owner: user.login,
      repo: UPSTREAM_REPO,
      path,
      branch,
      message: `editor: upload ${filename}`,
      content: buffer.toString("base64"),
      sha: existingSha,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const rawUrl = `https://raw.githubusercontent.com/${user.login}/${UPSTREAM_REPO}/${branch}/${path}`;
  return NextResponse.json({ url: rawUrl, path, filename });
}
