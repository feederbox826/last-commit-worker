export default {
  async fetch(request, env, ctx) {
    const reqUrl = new URL(request.url);
    const reponame = reqUrl.pathname;
    let gist = Boolean(reqUrl.searchParams.get("gist"));
    // repo regex
    if (!/^\/[\w\.-]+\/[\w\.-]+$/.test(reponame)) return new Response("null");
    // gist regex
    if (/^\/[\w\.-]+\/[a-f0-9]{32}$/.test(reponame)) gist = true;
    const type = gist ? "gist" : "repos";
    const apiUrl = `https://api.github.com/${type}${reponame}/commits`;
    const date = await fetch(apiUrl, {
      headers: {
        "User-Agent": "fbox826/last-commit",
      },
    })
      .then((response) => response.json())
      .then((data) => data[0].commit.author.date.split("T")[0]);
    return new Response(`<date>${date}</date>`);
  },
};
