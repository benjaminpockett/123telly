const fetch = require("node-fetch");
const cheerio = require("cheerio");

async function fetchDeepestIframe(url, depth = 0, maxDepth = 5) {
  if (depth > maxDepth) {
    throw new Error("Max iframe depth reached");
  }

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await response.text();
  const $ = cheerio.load(html);

  const iframeSrc = $("iframe").attr("src");

  if (iframeSrc) {
    // Found another iframe → follow it
    const nextUrl = iframeSrc.startsWith("http") ? iframeSrc : `https:${iframeSrc}`;
    return fetchDeepestIframe(nextUrl, depth + 1, maxDepth);
  }

  // No iframes → clean and return this page
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
