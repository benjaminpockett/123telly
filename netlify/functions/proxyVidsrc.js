const fetch = require("node-fetch");
const cheerio = require("cheerio");

async function fetchDeepestIframe(url, visited = new Set()) {
  if (visited.has(url)) {
    throw new Error("Iframe loop detected");
  }
  visited.add(url);

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await response.text();
  const $ = cheerio.load(html);

  // Log the URL we're at (for debugging)
  console.log(`Visiting: ${url}`);

  const iframe = $("iframe").first();
  const iframeSrc = iframe.attr("src");

  if (iframeSrc) {
    // Found another iframe → follow it
    const nextUrl = iframeSrc.startsWith("http") ? iframeSrc : `https:${iframeSrc}`;
    return fetchDeepestIframe(nextUrl, visited);
  }

  // No iframes → clean this page and return it
  $("script").remove();
  $(".ad-container, .ads, .popups, .sponsor, #ads").remove();
  $("head").append("<style>.ad-container, .ads, .popups, .sponsor, #ads { display:none!important; }</style>");

  return $.html();
}

exports.handler = async function (event) {
  const { type, id, season, episode } = event.queryStringParameters || {};
  if (!type || !id) return { statusCode: 400, body: "Missing parameters" };

  let url = `https://vidsrc.to/embed/${type}/${id}`;
  if (type === "tv" && season && episode) url += `/${season}/${episode}`;

  try {
    const cleanedHtml = await fetchDeepestIframe(url);

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: cleanedHtml,
    };
  } catch (err) {
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
};
