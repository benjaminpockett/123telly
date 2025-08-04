const fetch = require("node-fetch");

exports.handler = async function (event) {
  const { url } = event.queryStringParameters || {};
  if (!url) return { statusCode: 400, body: "Missing url" };

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const contentType = response.headers.get("content-type");
    const body = await response.buffer();

    return {
      statusCode: 200,
      headers: { "Content-Type": contentType || "application/octet-stream" },
      body: body.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
};
