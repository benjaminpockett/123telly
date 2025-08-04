const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { URL } = require("url");

const MAX_IFRAME_DEPTH = 7;

// Helper: fetch page and follow iframes recursively to deepest page
async function fetchDeepestIframe(url, depth = 0) {
  if (depth > MAX_IFRAME_DEPTH) {
    throw new Error("Max iframe depth reached");
  }

  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Failed fetching ${url} (${res.status})`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Find iframe src on the page
  const iframeSrc = $("iframe").attr("src");
  if (iframeSrc) {
    // Normalize iframe src URL
    let nextUrl;
    if (iframeSrc.startsWith("http")) {
      nextUrl = iframeSrc;
    } else if (iframeSrc.startsWith("//")) {
      nextUrl = "https:" + iframeSrc;
    } else {
      // relative path
      const baseUrl = new URL(url);
      nextUrl = new URL(iframeSrc, baseUrl).href;
    }

    return fetchDeepestIframe(nextUrl, depth + 1);
  }

  // No iframe found, return the loaded page and its base URL
  return { $, baseUrl: new URL(url) };
}

// Rewrite all relevant URLs (iframe src, video src, scripts, links) in the HTML to proxy through Netlify
function rewriteUrls($, baseUrl, proxyBaseUrl) {
  // Rewrite iframe src to proxy
  $("iframe").each((i, el) => {
    const src = $(el).attr("src");
    if (!src) return;

    let absUrl;
    if (src.startsWith("http")) {
      absUrl = src;
    } else if (src.startsWith("//")) {
      absUrl = "https:" + src;
    } else {
      absUrl = new URL(src, baseUrl).href;
    }

    // Change iframe src to proxy endpoint
    const proxiedUrl = proxyBaseUrl + "?url=" + encodeURIComponent(absUrl);
    $(el).attr("src", proxiedUrl);
  });

  // Rewrite all resource URLs (script[src], link[href], img[src], video[src], source[src])
  $("script[src], link[href], img[src], video[src], source[src]").each((i, el) => {
    const tagName = el.tagName.toLowerCase();
    const attr = tagName === "link" ? "href" : "src";
    const originalUrl = $(el).attr(attr);
    if (!originalUrl) return;

    let absUrl;
    if (originalUrl.startsWith("http")) {
      absUrl = originalUrl;
    } else if (originalUrl.startsWith("//")) {
      absUrl = "https:" + originalUrl;
    } else {
      absUrl = new URL(originalUrl, baseUrl).href;
    }

    // If this is a /prorcp/... url, proxy it via /proxy/prorcp/ route
    const prorcpMatch = absUrl.match(/^(https?:\/\/[^\/]+)(\/prorcp\/.+)$/);
    if (prorcpMatch) {
      const proxiedProrcpUrl = proxyBaseUrl + "/proxy/prorcp" + prorcpMatch[2];
      $(el).attr(attr, proxiedProrcpUrl);
      return;
    }

    // Otherwise leave as original or keep absolute URL
    $(el).attr(attr, absUrl);
  });

  // Remove or hide ads containers if any
  $(".ad-container, .ads, .popups, .sponsor, #ads").remove();
  $("head").append("<style>.ad-container, .ads, .popups, .sponsor, #ads { display:none!important; }</style>");
}

// Proxy the /proxy/prorcp/* requests
async function handleProrcpProxy(path) {
  // The original site is cloudnestra.com based on your snippet
  const realUrl = "https://cloudnestra.com" + path.replace("/proxy/prorcp", "/prorcp");

  const res = await fetch(realUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) {
    return {
      statusCode: res.status,
      body: `Failed to fetch resource: ${realUrl}`,
    };
  }

  // Stream the response back with appropriate headers
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const buffer = await res.buffer();

  return {
    statusCode: 200,
    headers: {
      "Content-Type": contentType,
      // You can add more headers here (cache-control etc.) if needed
    },
    body: buffer.toString("base64"),
    isBase64Encoded: true,
  };
}

exports.handler = async function(event) {
  const { path, queryStringParameters } = event;

  // Handle prorcp proxy route
  if (path && path.startsWith("/proxy/prorcp")) {
    return handleProrcpProxy(path);
  }

  // Otherwise, main embed page proxy logic

  const { type, id, season, episode, url } = queryStringParameters || {};

  // If 'url' param is provided, proxy that exact url as cleaned embed (used for iframe rewriting)
  if (url) {
    try {
      const { $, baseUrl } = await fetchDeepestIframe(url);
      const proxyBaseUrl = event.headers["x-forwarded-proto"] + "://" + event.headers["host"] + event.rawUrl.split("?")[0];

      rewriteUrls($, baseUrl, proxyBaseUrl);

      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html" },
        body: $.html(),
      };
    } catch (err) {
      console.error(err);
      return { statusCode: 500, body: `Error fetching URL: ${err.message}` };
    }
  }

  // Validate required params for original vidsrc embed url
  if (!type || !id) {
    return { statusCode: 400, body: "Missing required parameters: type and id" };
  }

  // Build vidsrc embed url
  let embedUrl = `https://vidsrc.to/embed/${type}/${id}`;
  if (type === "tv" && season && episode) {
    embedUrl += `/${season}/${episode}`;
  }

  try {
    const { $, baseUrl } = await fetchDeepestIframe(embedUrl);
    const proxyBaseUrl = event.headers["x-forwarded-proto"] + "://" + event.headers["host"] + event.rawUrl.split("?")[0];

    rewriteUrls($, baseUrl, proxyBaseUrl);

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: $.html(),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
};
