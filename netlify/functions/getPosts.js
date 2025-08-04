const fs = require("fs");
const path = require("path");

exports.handler = async () => {
  const filePath = path.join(__dirname, "posts.json");
  const posts = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return {
    statusCode: 200,
    body: JSON.stringify(posts),
    headers: { "Content-Type": "application/json" },
  };
};
