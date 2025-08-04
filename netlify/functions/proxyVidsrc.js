const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { URL } = require("url");

exports.handler = async function (event) {
  const { url } = event.queryStringParameters || {};

  if (!url) {
    return {
      statusCode: 400,
      body: "Missing 'url' parameter",
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: `Failed to fetch URL: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      const html = await response.text();
      const $ = cheerio.load(html);
      const baseUrl = new URL(url);

      // Rewrite relative URLs to absolute
      $("a, link, script, img, iframe").each((_, el) => {
        const attr = $(el).is("link") ? "href" : "src";
        if ($(el).attr(attr)) {
          const original = $(el).attr(attr);
          if (original && !original.startsWith("http") && !original.startsWith("//")) {
            $(el).attr(attr, `${baseUrl.origin}${original.startsWith("/") ? original : "/" + original}`);
          }
        }
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html" },
        body: $.html(),
      };
    } else {
      const buffer = await response.buffer();
      return {
        statusCode: 200,
        headers: { "Content-Type": contentType },
        body: buffer.toString("base64"),
        isBase64Encoded: true,
      };
    }
  } catch (err) {
    console.error("Proxy error:", err);
    return {
      statusCode: 500,
      body: `Error: ${err.message}`,
    };
  }
};
