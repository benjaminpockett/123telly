const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { URL } = require("url");

// Helper: rewrite absolute URLs through proxy
function rewriteUrlThroughProxy(url) {
  return `/functions/proxy?url=${encodeURIComponent(url)}`;
}

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

  // Rewrite resource URLs (scripts, links, images, video sources) to go through proxy
  $("script, link, img, video, source").each((_, el) => {
    const tagName = $(el).get(0).tagName;
    let attr = "src";

    if (tagName === "link") attr = "href";

    const original = $(el).attr(attr);
    if (!original) return;

    let absoluteUrl = original;

    if (original.startsWith("//")) {
      absoluteUrl = "https:" + original;
    } else if (!original.startsWith("http")) {
      absoluteUrl = baseUrl.origin + (original.startsWith("/") ? original : "/" + original);
    }

    $(el).attr(attr, rewriteUrlThroughProxy(absoluteUrl));
  });

  // Remove ad scripts selectively
  $("script").each((_, el) => {
    const src = $(el).attr("src") || "";
    const content = $(el).html() || "";

    if (src.match(/ads?|pop|tracker|analytics/i) || content.match(/adProvider|popup|trackEvent/i)) {
      console.log(`Removed ad script: ${src || "[inline script]"}`);
      $(el).remove();
    }
  });

  // Remove ad containers
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
