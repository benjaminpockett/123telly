const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { URL } = require("url");

const { fetchDocument } = require("@cliqz/adblocker");
const { ElectronBlocker } = require("@cliqz/adblocker-electron");

// Since you want it all in one file, we’ll load filters once on first run:
let blockerPromise = null;
async function getBlocker() {
  if (blockerPromise) return blockerPromise;

  blockerPromise = ElectronBlocker.fromPrebuiltAdsAndTracking(fetchDocument);
  return blockerPromise;
}

function rewriteUrlThroughProxy(url) {
  return `/functions/proxy?url=${encodeURIComponent(url)}`;
}

async function fetchDeepestIframe(url, depth = 0, maxDepth = 7, blocker) {
  if (depth > maxDepth) throw new Error("Max iframe depth reached");

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await response.text();
  const $ = cheerio.load(html);

  // If iframe exists, follow it recursively
  const iframeSrc = $("iframe").attr("src");
  if (iframeSrc) {
    const nextUrl = iframeSrc.startsWith("http") ? iframeSrc : `https:${iframeSrc}`;
    return fetchDeepestIframe(nextUrl, depth + 1, maxDepth, blocker);
  }

  const baseUrl = new URL(url);

  // Remove ad containers
  $(".ad-container, .ads, .popups, .sponsor, #ads").remove();

  // Remove ad/tracker scripts
  $("script").each((_, el) => {
    const src = $(el).attr("src") || "";
    const content = $(el).html() || "";
    if (
      src.match(/ads?|pop|tracker|analytics/i) ||
      content.match(/adProvider|popup|trackEvent/i)
    ) {
      $(el).remove();
    }
  });

  // Rewrite all resource URLs if they are NOT blocked
  $("script, link, img, video, source, iframe").each((_, el) => {
    const tag = $(el).get(0).tagName;
    let attr = "src";
    if (tag === "link") attr = "href";
    else if (tag === "iframe") attr = "src";

    const original = $(el).attr(attr);
    if (!original) return;

    let absoluteUrl = original;
    if (original.startsWith("//")) {
      absoluteUrl = "https:" + original;
    } else if (!original.startsWith("http")) {
      absoluteUrl = baseUrl.origin + (original.startsWith("/") ? original : "/" + original);
    }

    // Check if this URL should be blocked by adblocker
    const shouldBlock = blocker.matches(absoluteUrl, { domain: baseUrl.hostname });

    if (shouldBlock) {
      $(el).remove();
    } else {
      // If you want to proxy resources, uncomment next line:
      // $(el).attr(attr, rewriteUrlThroughProxy(absoluteUrl));

      // Or just keep original absolute URLs:
      $(el).attr(attr, absoluteUrl);
    }
  });

  // Hide any leftover ad elements by CSS
  $("head").append(
    "<style>.ad-container, .ads, .popups, .sponsor, #ads { display:none!important; }</style>"
  );

  return $.html();
}

exports.handler = async function (event) {
  const { type, id, season, episode } = event.queryStringParameters || {};
  if (!type || !id) return { statusCode: 400, body: "Missing parameters" };

  try {
    const blocker = await getBlocker();

    let url = `https://vidsrc.to/embed/${type}/${id}`;
    if (type === "tv" && season && episode) url += `/${season}/${episode}`;

    const cleanedHtml = await fetchDeepestIframe(url, 0, 7, blocker);

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
