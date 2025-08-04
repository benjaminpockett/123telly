const fetch = require("node-fetch");

exports.handler = async function (event) {
  const { url } = event.queryStringParameters || {};
  if (!url) return { statusCode: 400, body: "Missing url" };

  console.log("Proxying URL:", url);

  try {
    // Forward some common headers to avoid blocks
    const headersToForward = {};
    if (event.headers["referer"]) headersToForward["referer"] = event.headers["referer"];
    if (event.headers["cookie"]) headersToForward["cookie"] = event.headers["cookie"];
    if (event.headers["user-agent"]) headersToForward["user-agent"] = event.headers["user-agent"];
    else headersToForward["user-agent"] = "Mozilla/5.0";

    const response = await fetch(url, { headers: headersToForward });

    console.log(`Fetched ${url} with status ${response.status}`);

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = await response.buffer();

    // Serve text-based content as UTF-8 text, binary as base64
    if (
      contentType.startsWith("text/") ||
      contentType.includes("javascript") ||
      contentType.includes("json") ||
      contentType.includes("xml")
    ) {
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
