const headers = {
  "User-Agent": "fbox826/last-commit",
};
const returnDate = (field) => `<date>${field.split("T")[0]}</date>`;
const repoRegex = new RegExp(/^\/[\w\.-]+\/[\w\.-]+$/);
const gistRegex = new RegExp(/^\/[a-f0-9]{32}$/);

export default {
  async fetch(request, env, ctx) {
    const reponame = new URL(request.url).pathname;
    if (gistRegex.test(reponame)) {
      const date = await fetch(`https://api.github.com/gists${reponame}`, {
        headers,
      })
        .then((response) => response.json())
        .then((data) => data.updated_at)
        .catch(err => new Response("error"));
      return new Response(returnDate(date));
    } else if (repoRegex.test(reponame)) {
      const date = await fetch(`https://api.github.com/repos${reponame}/commits`, {
        headers,
      })
        .then((response) => response.json())
        .then((data) => data[0].commit.author.date)
        .catch(err => new Response("error"));
      return new Response(returnDate(date));
    } else {
      // invalid syntax
      return new Response("null");
    }
  },
};
