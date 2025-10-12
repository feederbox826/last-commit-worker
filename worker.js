const headers = {
  "User-Agent": "fbox826/last-commit/v1",
  "Accept": "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28"
}
const returnDate = (field) => `<date>${field.split("T")[0]}</date>`
const rawDateOnly = (field) => field.split("T")[0]
const repoRegex = new RegExp(/^\/[\w\.-]+\/[\w\.-]+$/)
const branchRegex = new RegExp(/^\/[\w\.-]+\/[\w\.-]+\/.+$/)
const gistRegex = new RegExp(/^\/[a-f0-9]{32}$/)

const gistLookup = (reponame) =>
  fetch(`https://api.github.com/gists${reponame}`, { headers })
    .then(response => response.json())
    .then(data => data.updated_at)
    .catch(err => err)

const repoLookup = (reponame, branch) =>
  fetch(`https://api.github.com/repos${reponame}/commits${branch?`?sha=${branch}`:""}`, { headers })
    .then(response => response.json())
    .then(data => data[0].commit.author.date)
    .catch(err => err)

// tiered caching
const cacheTtl = (date) => {
  const parsedDate = Date.parse(date)
  if (isNaN(parsedDate)) return 0
  const diffSec = (Date.now() - parsedDate) / 1000
  if (isNaN(diffSec)) return 0
  const WEEK = 7 * 24 * 60 * 60
  const MONTH = 30 * 24 * 60 * 60
  return diffSec < MONTH
    ? WEEK // if less than 1mo, cache 1wk
    : MONTH // else, cache 1mo
}

const cachePut = (reponame, date, env) => {
  const expirationTtl = cacheTtl(date)
  // only set if value is different
  if (expirationTtl === 0) return
  env.KV_COMMITS.put(reponame, date, { expirationTtl })
}

const ghLookup = async (reponame, env, ctx) => {
  // look up and cache
  const lookup = gistRegex.test(reponame)
    ? await gistLookup(reponame)
    : repoRegex.test(reponame)
      ? await repoLookup(reponame)
      : branchRegex.test(reponame)
        ? await repoLookup(reponame.split("/").slice(0, 3).join("/"), reponame.split("/").pop())
        : "null"
  // async cache put
  ctx.waitUntil(cachePut(reponame, lookup, env))
  return lookup
}

// KV lookup
const splitLookup = async (reponame, env, ctx) => {
  // prefer KV lookup, fallback
  const kvResult = await env.KV_COMMITS.get(reponame)
  if (kvResult) {
    console.log("KV HIT")
    return kvResult
  }
  // ghLookup as fallback
  console.log("KV MISS")
  const ghResult = await ghLookup(reponame, env, ctx)
  if (ghResult == "null" || isNaN(Date.parse(ghResult))) return "null"
  return ghResult
}

export default {
  async fetch(request, env, ctx) {
    // set headers
    headers["Authorization"] = `Bearer ${env.GITHUB_TOKEN}`
    const url = new URL(request.url);
    const reponame = url.pathname;
    // early exit for null or invalid
    if (reponame == "") return new Response("invalid", { status: 400 })
    const skip = url.searchParams.get("refresh") === "true"
    const xml = url.searchParams.get("raw") !== "true"
    // look up in KV
    const res = skip
      ? await ghLookup(reponame, env, ctx)
      : await splitLookup(reponame, env, ctx)
    return xml
      ? new Response(returnDate(res))
      : new Response(rawDateOnly(res))
  }
}
