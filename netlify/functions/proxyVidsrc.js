const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { URL } = require("url");

async function fetchDeepestIframe(url, depth = 0, maxDepth = 7) {
  console.log(`Depth ${depth}: Fetching ${url}`);

  if (depth > maxDepth) {
    throw new Error("Max iframe depth reached");
  }

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await response.text();
  const $ = cheerio.load(html);

  const iframeSrc = $("iframe").attr("src");

  if (iframeSrc) {
    const nextUrl = iframeSrc.startsWith("http") ? iframeSrc : `https:${iframeSrc}`;
    return fetchDeepestIframe(nextUrl, depth + 1, maxDepth);
  }

  console.log(`Reached final page at depth ${depth}: ${url}`);

  const baseUrl = new URL(url);

  // Rewrite all resource URLs to absolute
  $("script, link, img, video, source").each((_, el) => {
    const attr = $(el).is("link") ? "href" : "src";
    const original = $(el).attr(attr);
    if (original && !original.startsWith("http") && !original.startsWith("//")) {
      $(el).attr(attr, `${baseUrl.origin}${original}`);
    }
  });

  // Keep only video-related scripts
  $("script").each((_, el) => {
    const src = $(el).attr("src") || "";
    const content = $(el).html() || "";
    if (src.match(/ads?|pop|tracker|analytics/i) || content.match(/adProvider|popup|trackEvent/i)) {
      console.log(`Removed ad script: ${src || "[inline script]"}`);
      $(el).remove();
    }
  });

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
    console.error(err);
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
};
