const fetch = require("node-fetch");

exports.handler = async function (event) {
  const { url } = event.queryStringParameters || {};
  if (!url) return { statusCode: 400, body: "Missing url" };

  try {
    const headers = {
      "User-Agent": event.headers["user-agent"] || "Mozilla/5.0",
      Referer: event.headers["referer"] || url,
    };

    const response = await fetch(url, { headers });

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = await response.buffer();

    const isText = contentType.startsWith("text/") || contentType.includes("javascript") || contentType.includes("json") || contentType.includes("xml");

    return {
      statusCode: 200,
      headers: { "Content-Type": contentType },
      body: isText ? buffer.toString("utf8") : buffer.toString("base64"),
      isBase64Encoded: !isText,
    };
  } catch (error) {
    return { statusCode: 500, body: `Error fetching resource: ${error.message}` };
  }
};
