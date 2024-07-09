const headers = {
  "User-Agent": "fbox826/last-commit/v1",
};
const returnDate = (field) => `<date>${field.split("T")[0]}</date>`;
const repoRegex = new RegExp(/^\/[\w\.-]+\/[\w\.-]+$/);
const gistRegex = new RegExp(/^\/[a-f0-9]{32}$/);

export default {
  async fetch(request, env, ctx) {
    const reponame = new URL(request.url).pathname;
    // set up caching
    const fetchOptions = {
      headers,
      cf: {
        cacheTtl: 86400, // 1 day
        cacheEverything: true,
        cacheKey: reponame,
        cacheTtlByStatus: {
          "200-299": 86400, // 1 day
          404: 60, // 1 minute
          "500-599": 0, // no cache
        },
      },
    };
    if (gistRegex.test(reponame)) {
      const res = await fetch(
        `https://api.github.com/gists${reponame}`,
        fetchOptions,
      )
        .then((response) => response.json())
        .then((data) => data.updated_at)
        .then(returnDate)
        .catch((err) => err);
      return new Response(res);
    } else if (repoRegex.test(reponame)) {
      const res = await fetch(
        `https://api.github.com/repos${reponame}/commits`,
        fetchOptions,
      )
        .then((response) => response.json())
        .then((data) => data[0].commit.author.date)
        .then(returnDate)
        .catch((err) => err);
      return new Response(res);
    } else {
      // invalid syntax
      return new Response("null");
    }
  },
};
