const fetch = require("node-fetch");
const cheerio = require("cheerio");

const PROXY_BASE = "https://your-netlify-site.netlify.app/.netlify/functions/proxyVidsrc";

exports.handler = async function(event) {
  const { path, queryStringParameters } = event;
  console.log("Request path:", path);

  // If requesting a proxied prorcp resource
  if (path.startsWith("/proxy/prorcp/")) {
    const prorcpPath = path.replace("/proxy/prorcp/", "");
    const targetUrl = `https://cloudnestra.com/prorcp/${prorcpPath}`;
    try {
      const resp = await fetch(targetUrl, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (!resp.ok) return { statusCode: resp.status, body: resp.statusText };
      const contentType = resp.headers.get("content-type") || "application/octet-stream";
      const buffer = await resp.buffer();
      return {
        statusCode: 200,
        headers: { "Content-Type": contentType },
        body: buffer.toString("base64"),
        isBase64Encoded: true,
      };
    } catch (e) {
      return { statusCode: 500, body: "Error fetching prorcp resource" };
    }
  }

  // Main embed proxy
  const { type, id, season, episode } = queryStringParameters || {};
  if (!type || !id) {
    return { statusCode: 400, body: "Missing type or id" };
  }

  let url = `https://vidsrc.to/embed/${type}/${id}`;
  if (type === "tv" && season && episode) url += `/${season}/${episode}`;

  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) return { statusCode: response.status, body: response.statusText };

    let html = await response.text();

    const $ = cheerio.load(html);

    // Rewrite iframe src attributes
    $("iframe").each((i, el) => {
      let src = $(el).attr("src");
      if (!src) return;

      // If src includes /prorcp/, rewrite to proxy
      if (src.includes("/prorcp/")) {
        const match = src.match(/(\/prorcp\/.+)/);
        if (match) {
          $(el).attr("src", PROXY_BASE + "/proxy" + match[1]);
          return;
        }
      }

      // If src is relative, make absolute and proxy it
      if (!src.startsWith("http")) {
        try {
          const absoluteUrl = new URL(src, url).href;
          // We can proxy this URL by passing as a url query param
          $(el).attr("src", PROXY_BASE + "?url=" + encodeURIComponent(absoluteUrl));
        } catch {}
      }
    });

    // Also rewrite video source src attributes (if present)
    $("source").each((i, el) => {
      let src = $(el).attr("src");
      if (!src) return;

      if (src.includes("/prorcp/")) {
        const match = src.match(/(\/prorcp\/.+)/);
        if (match) {
          $(el).attr("src", PROXY_BASE + "/proxy" + match[1]);
          return;
        }
      }

      if (!src.startsWith("http")) {
        try {
          const absoluteUrl = new URL(src, url).href;
          $(el).attr("src", PROXY_BASE + "?url=" + encodeURIComponent(absoluteUrl));
        } catch {}
      }
    });

    // If a `url` query param is provided, proxy that resource directly
    if (queryStringParameters && queryStringParameters.url) {
      const target = queryStringParameters.url;
      try {
        const resp = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!resp.ok) return { statusCode: resp.status, body: resp.statusText };

        const contentType = resp.headers.get("content-type") || "application/octet-stream";
        const buf = await resp.buffer();

        return {
          statusCode: 200,
          headers: { "Content-Type": contentType },
          body: buf.toString("base64"),
          isBase64Encoded: true,
        };
      } catch {
        return { statusCode: 500, body: "Error proxying resource" };
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: $.html(),
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
