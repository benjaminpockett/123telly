const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { URL } = require("url");

exports.handler = async (event) => {
  const url = event.queryStringParameters.url;

  if (!url) {
    return { statusCode: 400, body: "Missing ?url=..." };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: `Failed to fetch: ${response.statusText}`,
      };
    }

    if (contentType.includes("text/html")) {
      const html = await response.text();
      const $ = cheerio.load(html);
      const base = new URL(url);

      // Make relative URLs absolute
      $("a, link, script, img, iframe").each((_, el) => {
        const attr = $(el).is("link") ? "href" : "src";
        const val = $(el).attr(attr);
        if (val && !val.startsWith("http") && !val.startsWith("//")) {
          const absolute = new URL(val, base).href;
          $(el).attr(attr, absolute);
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
    return {
      statusCode: 500,
      body: `Error: ${err.message}`,
    };
  }
};
