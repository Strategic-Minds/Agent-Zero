/**
 * GitHub Operations Utility
 * Full CRUD for GitHub repos — used by APEX to push generated code
 */

export interface GitHubFile {
  path: string
  content: string
  message?: string
}

export interface CommitResult {
  success: boolean
  sha: string
  url: string
  path: string
}

const GITHUB_API = 'https://api.github.com'

function getToken(): string {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN not set')
  return token
}

function getRepo(): string {
  const repo = process.env.GITHUB_REPO
  if (!repo) throw new Error('GITHUB_REPO not set')
  return repo
}

async function ghFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `token ${getToken()}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

export async function getFileSha(filePath: string, repo?: string): Promise<string | null> {
  const r = repo || getRepo()
  const res = await ghFetch(`/repos/${r}/contents/${filePath}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.sha || null
}

export async function pushFile(file: GitHubFile, repo?: string): Promise<CommitResult> {
  const r = repo || getRepo()
  const sha = await getFileSha(file.path, r)
  
  const body: Record<string, unknown> = {
    message: file.message || `apex: update ${file.path}`,
    content: Buffer.from(file.content, 'utf-8').toString('base64'),
  }
  if (sha) body.sha = sha

  const res = await ghFetch(`/repos/${r}/contents/${file.path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`GitHub push failed: ${err.message}`)
  }

  const data = await res.json()
  return {
    success: true,
    sha: data.content?.sha || '',
    url: data.content?.html_url || '',
    path: file.path,
  }
}

export async function pushFiles(files: GitHubFile[], repo?: string): Promise<CommitResult[]> {
  const results: CommitResult[] = []
  for (const file of files) {
    try {
      const result = await pushFile(file, repo)
      results.push(result)
    } catch (e) {
      results.push({ success: false, sha: '', url: '', path: file.path })
    }
    await new Promise(r => setTimeout(r, 100)) // Rate limit protection
  }
  return results
}

export async function readFile(filePath: string, repo?: string): Promise<string | null> {
  const r = repo || getRepo()
  const res = await ghFetch(`/repos/${r}/contents/${filePath}`)
  if (!res.ok) return null
  const data = await res.json()
  return Buffer.from(data.content, 'base64').toString('utf-8')
}

export async function listDir(dirPath: string, repo?: string): Promise<Array<{ name: string; type: string; path: string }>> {
  const r = repo || getRepo()
  const res = await ghFetch(`/repos/${r}/contents/${dirPath}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data.map(f => ({ name: f.name, type: f.type, path: f.path })) : []
}

export async function getLatestCommit(repo?: string): Promise<{ sha: string; message: string; date: string } | null> {
  const r = repo || getRepo()
  const res = await ghFetch(`/repos/${r}/commits/main`)
  if (!res.ok) return null
  const data = await res.json()
  return {
    sha: data.sha?.slice(0, 10) || '',
    message: data.commit?.message || '',
    date: data.commit?.author?.date || '',
  }
}
