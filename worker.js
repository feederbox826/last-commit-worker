const headers = {
  "User-Agent": "fbox826/last-commit/v1"
}
const returnDate = (field) => `<date>${field.split("T")[0]}</date>`
const repoRegex = new RegExp(/^\/[\w\.-]+\/[\w\.-]+$/)
const gistRegex = new RegExp(/^\/[a-f0-9]{32}$/)

const gistLookup = (reponame) =>
  fetch(`https://api.github.com/gists${reponame}`, { headers })
    .then(response => response.json())
    .then(data => data.updated_at)
    .catch(err => err)

const repoLookup = (reponame) =>
  fetch(`https://api.github.com/repos${reponame}/commits`, { headers })
    .then(response => response.json())
    .then(data => data[0].commit.author.date)
    .catch(err => err)

// tiered caching
const cacheTtl = (date) => {
  const parsedDate = Date.parse(date)
  if (isNaN(parsedDate)) return 0
  const diff = Date.now() - parsedDate
  if (isNaN(diff)) return 0
  const day = 86400
  const week = 604800
  const month = 2592000
  return diff < week * 1000
    ? day // if less than 1wk, cache 1d
    : diff < month * 1000
      ? week // if less than 1mo, cache 1wk
      : diff > month * 1000
        ? month // if more than 1mo, cache 1mo
        : 0
}

const cachePut = (reponame, date, env) => {
  const expirationTtl = cacheTtl(date)
  // only set if value is different
  if (expirationTtl === 0) return
  env.KV_COMMITS.put(reponame, date, { expirationTtl })
}

const ghLookup = async (reponame, env) => {
  // look up and cache
  const lookup = gistRegex.test(reponame)
    ? await gistLookup(reponame)
    : repoRegex.test(reponame)
      ? await repoLookup(reponame)
      : "null"
  // async cache put
  cachePut(reponame, lookup, env)
  return lookup
}

// KV lookup
const splitLookup = async (reponame, env, skip = false) => {
  // prefer KV lookup, fallback
  const kvResult = await env.KV_COMMITS.get(reponame, { cacheTtl: 86400 })
  if (kvResult) return returnDate(kvResult)
  // ghLookup as fallback
  const ghResult = await ghLookup(reponame, env)
  if (ghResult == "null" || isNaN(Date.parse(ghResult))) return "null"
  return returnDate(ghResult)
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const reponame = url.pathname;
    const skip = url.searchParams.get("refresh") === "true"
    // look up in KV
    const res = skip
      ? await ghLookup(reponame, env)
      : await splitLookup(reponame, env)
    return new Response(res)
  }
}
