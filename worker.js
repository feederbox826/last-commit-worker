export default {
  async fetch(request, env, ctx) {
    const reqUrl = new URL(request.url);
    const reponame = reqUrl.pathname;
    const headers = {
      "User-Agent": "fbox826/last-commit",
    };
    let gist = Boolean(reqUrl.searchParams.get("gist"));
    // repo regex
    if (!/^(\/[\w\.-]+\/[\w\.-]+)|([a-f0-9]{32})$/.test(reponame)) return new Response("null");
    // gist regex
    if (/^\/[a-f0-9]{32}$/.test(reponame)) gist = true;
    if (gist) {
      const apiRepoURL = `https://api.github.com/gists${reponame}`;
      const date = await fetch(apiRepoURL, {
        headers,
      })
        .then((response) => response.json())
        .then((data) => data.updated_at.split("T")[0]);
      return new Response(`<date>${date}</date>`);
    } else {
      const apiRepoURL = `https://api.github.com/repos${reponame}/commits`;
      const date = await fetch(apiRepoURL, {
        headers,
      })
        .then((response) => response.json())
        .then((data) => data[0].commit.author.date.split("T")[0]);
      return new Response(`<date>${date}</date>`);
    }
  },
};
