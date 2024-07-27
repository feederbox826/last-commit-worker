const headers = {
  "User-Agent": "fbox826/last-commit/v1",
};
const returnDate = (field) => `<date>${field.split("T")[0]}</date>`;
const repoRegex = new RegExp(/^\/[\w\.-]+\/[\w\.-]+$/);
const gistRegex = new RegExp(/^\/[a-f0-9]{32}$/);

const gistLookup = async (reponame) =>
  fetch(
    `https://api.github.com/gists${reponame}`,
    { headers},
  )
    .then((response) => response.json())
    .then((data) => data.updated_at)
    .catch((err) => err);

const repoLookup = async (reponame) =>
  fetch(
    `https://api.github.com/repos${reponame}/commits`,
    { headers },
  )
    .then((response) => response.json())
    .then((data) => data[0].commit.author.date)
    .catch((err) => err);

// tiered caching
const cacheTtl = (date) => {
  const diff = Date.now() - Date.parse(date);
  if (isNaN(diff)) return 0;
  const day = 86400
  const week = 604800
  const month = 2592000
  // if less than 1w, cache 1d
  if (diff < week * 1000) {
    return day;
  } else if (diff < month * 1000) {
    // if less than 1m, cache 1w
    return week;
  } else if (diff > month * 1000) {
    // if more than 1m, cache 1m
    return month;
  }
  return 0;
}

const cachePut = async (reponame, date) => {
  const expirationTtl = cacheTtl(date);
  if (expirationTtl === 0) return
  await env.KV_COMMITS.put(reponame, date, { expirationTtl });
}

// KV lookup
const kvLookup = async (reponame) => {
  // tiered cache lookup
  const cached = await env.KV_COMMITS.get(reponame);
  let res = cached
    ? cached
    : gistRegex.test(reponame)
      ? gistLookup(reponame)
      : repoRegex.test(reponame)
        ? repoLookup(reponame)
        : "null";
  if (res == "null") return "null"
  await cachePut(reponame, res);
  return returnDate(res);
}

export default {
  async fetch(request, env, ctx) {
    const reponame = new URL(request.url).pathname;
    // look up in KV
    const res = await kvLookup(reponame);
    return new Response(res);
  }
};
