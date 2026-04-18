/**
 * Submission endpoint. Accepts { frontmatter, mdx, category, slug } from the
 * /contribute editor, validates, and opens a PR on the user's behalf.
 *
 * v1 strategy: use the contributor's own GitHub OAuth token to (a) fork the
 * upstream repo if needed, (b) write the MDX to a new branch on their fork,
 * (c) open a PR from their fork back to DivineSkins/divine-wiki:main. No
 * GitHub App or PAT required for this path, and every commit is attributed
 * to the contributor's GitHub identity automatically.
 *
 * When the submission-pr Cloudflare Worker is deployed, set
 * CLOUDFLARE_SUBMIT_WORKER_URL and this route will forward instead. The
 * Worker path supports tighter rate-limiting via KV and can use a GitHub
 * App installation if you'd rather not rely on user tokens.
 */
import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import { readTokenCookie, fetchGitHubUser } from "@/lib/github-oauth";

const UPSTREAM_OWNER = "DivineSkins";
const UPSTREAM_REPO = "divine-wiki";
const UPSTREAM_BASE = "main";

const SUBMISSION_SCHEMA = z.object({
  frontmatter: z.object({
    title: z.string().min(3).max(80),
    description: z.string().min(10).max(200),
    category: z.enum([
      "guided-walkthrough",
      "tools",
      "maya",
      "blender",
      "animations",
      "vfx-bins",
      "assets-library",
      "errors",
    ]),
  }),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  mdx: z.string().min(50).max(200_000),
  discord: z.string().max(40).optional(),
});

function targetPath(category: string, slug: string): string {
  return `content/docs/en/${category}/${slug}.mdx`;
}

function buildMdxFile(body: z.infer<typeof SUBMISSION_SCHEMA>): string {
  const fm = [
    "---",
    `title: "${body.frontmatter.title.replace(/"/g, '\\"')}"`,
    `description: "${body.frontmatter.description.replace(/"/g, '\\"')}"`,
    `category: "${body.frontmatter.category}"`,
    "---",
    "",
  ].join("\n");
  return fm + body.mdx.trim() + "\n";
}

function prBody(params: {
  login: string;
  discord?: string;
  category: string;
  slug: string;
}): string {
  return [
    "## What this PR changes",
    "",
    `Adds \`content/docs/en/${params.category}/${params.slug}.mdx\`, submitted through the in-site editor.`,
    "",
    "## Author",
    "",
    `- GitHub: [@${params.login}](https://github.com/${params.login})`,
    params.discord ? `- Discord: ${params.discord}` : "- Discord: *not provided*",
    "",
    "## Preview",
    "",
    "*Cloudflare Pages will add the preview deployment link below once the build completes.*",
  ].join("\n");
}

async function forkUpstream(octokit: Octokit, login: string) {
  try {
    await octokit.repos.get({ owner: login, repo: UPSTREAM_REPO });
    return; // Fork already exists.
  } catch {
    // Fall through and create it.
  }

  await octokit.repos.createFork({
    owner: UPSTREAM_OWNER,
    repo: UPSTREAM_REPO,
  });

  // Forks can take a few seconds to become available on GitHub's side.
  // Poll up to ~10 seconds.
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await octokit.repos.get({ owner: login, repo: UPSTREAM_REPO });
      return;
    } catch {
      /* keep waiting */
    }
  }
  throw new Error("Fork did not become available in time. Try submitting again.");
}

async function syncForkWithUpstream(
  octokit: Octokit,
  login: string,
): Promise<string> {
  // Get the upstream SHA so we branch off current main.
  const upstreamMain = await octokit.git.getRef({
    owner: UPSTREAM_OWNER,
    repo: UPSTREAM_REPO,
    ref: `heads/${UPSTREAM_BASE}`,
  });
  const baseSha = upstreamMain.data.object.sha;

  // Fast-forward the fork's main to upstream. Succeeds if the fork has no
  // local commits ahead of upstream, which should always be true for
  // contrib-only forks.
  try {
    await octokit.git.updateRef({
      owner: login,
      repo: UPSTREAM_REPO,
      ref: `heads/${UPSTREAM_BASE}`,
      sha: baseSha,
      force: true,
    });
  } catch {
    // If updateRef fails (e.g. fork has diverged), we still proceed —
    // branching off upstream sha directly is fine for new files.
  }

  return baseSha;
}

export async function POST(req: NextRequest) {
  const token = readTokenCookie(req);
  if (!token) {
    return NextResponse.json(
      { error: "Not signed in. Click 'Sign in with GitHub' first." },
      { status: 401 },
    );
  }

  let payload: z.infer<typeof SUBMISSION_SCHEMA>;
  try {
    const raw = await req.json();
    payload = SUBMISSION_SCHEMA.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // If a Worker is configured, forward the signed request there.
  const workerUrl = process.env.CLOUDFLARE_SUBMIT_WORKER_URL;
  if (workerUrl) {
    const res = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  }

  // Fallback: open the PR directly from this route.
  const octokit = new Octokit({ auth: token });

  let user;
  try {
    user = await fetchGitHubUser(token);
  } catch {
    return NextResponse.json(
      { error: "Your GitHub session expired. Sign in again." },
      { status: 401 },
    );
  }

  const ageMs = Date.now() - new Date(user.created_at).getTime();
  if (ageMs < 7 * 24 * 60 * 60 * 1000) {
    return NextResponse.json(
      { error: "GitHub accounts must be at least 7 days old to submit." },
      { status: 403 },
    );
  }

  const branch = `contrib/${user.login}/${payload.slug}-${Date.now().toString(36)}`;
  const path = targetPath(payload.frontmatter.category, payload.slug);
  const content = buildMdxFile(payload);

  try {
    await forkUpstream(octokit, user.login);
    const baseSha = await syncForkWithUpstream(octokit, user.login);

    // Create branch on the fork from the upstream base sha.
    await octokit.git.createRef({
      owner: user.login,
      repo: UPSTREAM_REPO,
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    });

    // Commit the file.
    await octokit.repos.createOrUpdateFileContents({
      owner: user.login,
      repo: UPSTREAM_REPO,
      path,
      branch,
      message: `guide: add ${payload.frontmatter.category}/${payload.slug}`,
      content: Buffer.from(content, "utf-8").toString("base64"),
    });

    // Open PR against upstream.
    const pr = await octokit.pulls.create({
      owner: UPSTREAM_OWNER,
      repo: UPSTREAM_REPO,
      title: `guide: ${payload.frontmatter.title}`,
      head: `${user.login}:${branch}`,
      base: UPSTREAM_BASE,
      body: prBody({
        login: user.login,
        discord: payload.discord,
        category: payload.frontmatter.category,
        slug: payload.slug,
      }),
      maintainer_can_modify: true,
    });

    return NextResponse.json({
      prUrl: pr.data.html_url,
      prNumber: pr.data.number,
      branch,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submission failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
