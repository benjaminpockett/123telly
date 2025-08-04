const fs = require("fs");
const path = require("path");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { text } = JSON.parse(event.body || "{}");
  if (!text) {
    return { statusCode: 400, body: "Missing 'text' field" };
  }

  const filePath = path.join(__dirname, "posts.json");
  const posts = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const newPost = {
    id: Date.now(),
    text,
  };

  posts.push(newPost);
  fs.writeFileSync(filePath, JSON.stringify(posts, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify(newPost),
    headers: { "Content-Type": "application/json" },
  };
};
