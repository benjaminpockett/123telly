const fetch = require("node-fetch");

exports.handler = async function (event) {
  const { url } = event.queryStringParameters || {};
  if (!url) return { statusCode: 400, body: "Missing url" };

  console.log("Proxying URL:", url);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    console.log(`Fetched ${url} with status ${response.status}`);

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = await response.buffer();

    // Check if content-type is text, send plain text, else base64
    if (contentType.startsWith("text/") || contentType.includes("javascript") || contentType.includes("json") || contentType.includes("xml")) {
      return {
        statusCode: 200,
        headers: { "Content-Type": contentType },
        body: buffer.toString("utf8"),
        isBase64Encoded: false,
      };
    } else {
      return {
        statusCode: 200,
        headers: { "Content-Type": contentType },
        body: buffer.toString("base64"),
        isBase64Encoded: true,
      };
    }
  } catch (err) {
    console.error("Proxy error:", err);
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
};
