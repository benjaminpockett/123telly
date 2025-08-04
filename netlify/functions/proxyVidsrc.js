const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { URL } = require("url");

exports.handler = async function(event) {
  const { path, queryStringParameters } = event;
  console.log("Incoming path:", path);
  console.log("Query params:", queryStringParameters);

  // Base URL of this Netlify function for rewriting URLs
  // Adjust this if your function route differs
  const PROXY_BASE = "https://charming-cascaron-b1b73d.netlify.app/.netlify/functions/proxyVidsrc";

  // If the path includes /proxy/prorcp/, handle that proxy request
  if (path && path.includes("/proxy/prorcp/")) {
    console.log("Handling prorcp proxy for path:", path);

    // Extract the prorcp path after /proxy/prorcp/
    // e.g. /proxy/prorcp/XYZ123 => XYZ123
    const prorcpPathMatch = path.match(/\/proxy\/prorcp\/(.+)/);
    if (!prorcpPathMatch) {
      return { statusCode: 400, body: "Invalid prorcp path" };
    }
    const prorcpPath = prorcpPathMatch[1];

    // Construct the target URL to fetch from cloudnestra.com or original host
    // Your prorcp URLs look like base64-ish tokens, so the real source is cloudnestra.com
    const targetUrl = `https://cloudnestra.com/prorcp/${prorcpPath}`;

    try {
      const resp = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          // Forward other headers if needed
        }
      });
      if (!resp.ok) {
        console.log("Error fetching prorcp resource:", resp.status);
        return { statusCode: resp.status, body: `Error fetching prorcp resource: ${resp.statusText}` };
      }

      // Pass through the content-type header from original response
      const contentType = resp.headers.get("content-type") || "application/octet-stream";

      const bodyBuffer = await resp.buffer();

      return {
        statusCode: 200,
        headers: {
          "Content-Type": contentType,
          // Add any CORS or cache headers if needed
        },
        body: bodyBuffer.toString("base64"),
        isBase64Encoded: true,
      };
    } catch (err) {
      console.error("Error proxying prorcp:", err);
      return { statusCode: 500, body: "Internal Server Error" };
    }
  }

  // Otherwise, handle the main vidsrc embed page
  const { type, id, season, episode } = queryStringParameters || {};
  if (!type || !id) {
    return { statusCode: 400, body: "Missing required parameters type or id" };
  }

  let url = `https://vidsrc.to/embed/${type}/${id}`;
  if (type === "tv" && season && episode) {
    url += `/${season}/${episode}`;
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok) {
      return { statusCode: response.status, body: `Error fetching vidsrc page: ${response.statusText}` };
    }
    const html = await response.text();

    // Load with cheerio
    const $ = cheerio.load(html);

    // Follow nested iframes to get the deepest page that hosts the player iframe
    async function fetchDeepestIframeContent(srcUrl, depth = 0, maxDepth = 7) {
      if (depth > maxDepth) throw new Error("Max iframe depth reached");

      const res = await fetch(srcUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`Failed to fetch iframe src ${srcUrl}: ${res.statusText}`);

      const iframeHtml = await res.text();
      const $$ = cheerio.load(iframeHtml);

      const iframeSrc = $$("iframe").attr("src");
      if (iframeSrc) {
        // Normalize iframe src URL
        const nextUrl = iframeSrc.startsWith("http") ? iframeSrc : `https:${iframeSrc}`;
        return fetchDeepestIframeContent(nextUrl, depth + 1, maxDepth);
      }

      // Rewrite URLs in this final iframe page to route through proxy
      const baseUrl = new URL(srcUrl);

      // Rewrite all iframe srcs and prorcp URLs to proxy URLs
      $$("iframe").each((_, el) => {
        const src = $$(el).attr("src");
        if (src) {
          let newSrc = src;
          // Rewrite prorcp URLs to go through proxy
          if (src.includes("/prorcp/")) {
            const match = src.match(/(\/prorcp\/.+)/);
            if (match) {
              newSrc = PROXY_BASE + "/proxy" + match[1];
            }
          }
          // Also handle relative URLs by converting to absolute URLs via proxy if needed
          else if (!src.startsWith("http")) {
            const absoluteUrl = new URL(src, baseUrl).href;
            newSrc = PROXY_BASE + "?url=" + encodeURIComponent(absoluteUrl);
          }
          $$(el).attr("src", newSrc);
        }
      });

      // Rewrite video source src attributes
      $$("source, video").each((_, el) => {
        const src = $$(el).attr("src");
        if (src) {
          let newSrc = src;
          if (src.includes("/prorcp/")) {
            const match = src.match(/(\/prorcp\/.+)/);
            if (match) {
              newSrc = PROXY_BASE + "/proxy" + match[1];
            }
          } else if (!src.startsWith("http")) {
            const absoluteUrl = new URL(src, baseUrl).href;
            newSrc = PROXY_BASE + "?url=" + encodeURIComponent(absoluteUrl);
          }
          $$(el).attr("src", newSrc);
        }
      });

      // Remove common ad elements if needed
      $$(".ad-container, .ads, .popups, .sponsor, #ads").remove();

      return $$.html();
    }

    // Get the first iframe src in the main page
    const firstIframeSrc = $("iframe").attr("src");
    if (!firstIframeSrc) {
      return { statusCode: 500, body: "No iframe found in vidsrc embed page" };
    }
    const firstIframeUrl = firstIframeSrc.startsWith("http") ? firstIframeSrc : `https:${firstIframeSrc}`;

    // Get deepest iframe content with rewritten URLs
    const cleanedHtml = await fetchDeepestIframeContent(firstIframeUrl);

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: cleanedHtml,
    };

  } catch (err) {
    console.error("Error in handler:", err);
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
};
