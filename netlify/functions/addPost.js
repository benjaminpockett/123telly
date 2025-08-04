export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { text } = JSON.parse(event.body || "{}");
  if (!text) {
    return { statusCode: 400, body: "Missing 'text' field" };
  }

  const { kv } = await import("@netlify/kv");
  const posts = (await kv.get("posts")) || [];

  const newPost = {
    id: Date.now(),
    text,
  };

  posts.push(newPost);
  await kv.set("posts", posts);

  return {
    statusCode: 200,
    body: JSON.stringify(newPost),
    headers: { "Content-Type": "application/json" },
  };
}
