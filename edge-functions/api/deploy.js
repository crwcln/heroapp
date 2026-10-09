// edge-functions/api/deploy.js  ->  POST /api/deploy
// Env vars (EdgeOne Pages project settings): ADMIN_PASSWORD, DEPLOY_WEBHOOK_URL,
// GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), optional DEPLOY_BRANCH (defaults to main).
// GitHub token must be able to read and write repository contents. It stays server-side.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const enc = new TextEncoder();

async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function validToken(token, secret) {
  if (typeof token !== 'string') return false;
  const [expStr, sig] = token.split('.');
  const exp = Number(expStr);
  if (!exp || !sig || Date.now() > exp) return false;
  return safeEqual(sig, await hmacHex(secret, `admin.${exp}`));
}

export async function onRequestPost(context) {
  const secret = context.env.ADMIN_PASSWORD;
  const hook = context.env.DEPLOY_WEBHOOK_URL;
  const githubToken = context.env.GITHUB_TOKEN;
  const repository = context.env.GITHUB_REPOSITORY || 'crwcln/heroapp';
  const branch = context.env.DEPLOY_BRANCH || 'main';
  if (!secret || !hook || !githubToken) return json({ ok: false, error: 'not_configured' }, 500);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !/^[A-Za-z0-9_.-]+$/.test(branch)) {
    return json({ ok: false, error: 'invalid_deploy_config' }, 500);
  }

  let body;
  let commitSha = '', branchUpdated = false;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  if (!(await validToken(body && body.token, secret))) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 120 || /[\r\n]/.test(message)) {
    return json({ ok: false, error: 'invalid_message' }, 400);
  }

  const gh = async (path, options = {}) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error('GitHub request failed'), { status: response.status });
    return data;
  };

  try {
    // Create a new commit with the same tree as the branch head, then advance the branch.
    // This forces a fresh deployment without changing any website files.
    const ref = await gh(`git/ref/heads/${encodeURIComponent(branch)}`);
    const parentSha = ref.object.sha;
    const parent = await gh(`git/commits/${parentSha}`);
    const commit = await gh('git/commits', {
      method: 'POST',
      body: JSON.stringify({ message, tree: parent.tree.sha, parents: [parentSha] }),
    });
    commitSha = commit.sha;
    await gh(`git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    branchUpdated = true;

    const r = await fetch(hook, { method: 'POST' });
    if (!r.ok) return json({ ok: false, error: 'hook_failed', status: r.status, commitSha: commit.sha, commitCreated: true }, 502);
    return json({ ok: true, commitSha: commit.sha, commitMessage: message, branch });
  } catch (error) {
    if (branchUpdated) return json({ ok: false, error: 'hook_unreachable', commitCreated: true, commitSha, status: error && error.status || 0 }, 502);
    return json({ ok: false, error: 'github_failed', status: error && error.status || 0 });
  }
}
