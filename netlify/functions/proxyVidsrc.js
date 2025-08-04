const fetch = require("node-fetch");
const cheerio = require("cheerio");

exports.handler = async function(event) {
  const { type, id, season, episode } = event.queryStringParameters || {};
  if (!type || !id) return { statusCode: 400, body: "Missing parameters" };

  let url = `https://vidsrc.to/embed/${type}/${id}`;
  if (type === "tv" && season && episode) url += `/${season}/${episode}`;

  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove ALL scripts
    $("script").remove();

    // Remove ads and popups (just in case there are ad containers outside scripts)
    $(".ad-container, .ads, .popups, .sponsor, #ads").remove();

    // Inject CSS to hide leftover ad placeholders
    $("head").append("<style>.ad-container, .ads, .popups, .sponsor, #ads { display:none!important; }</style>");

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: $.html(),
    };
  } catch (err) {
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
};
