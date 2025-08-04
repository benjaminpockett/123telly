export async function handler() {
  const { kv } = await import("@netlify/kv");
  const posts = (await kv.get("posts")) || [];
  return {
    statusCode: 200,
    body: JSON.stringify(posts),
    headers: { "Content-Type": "application/json" },
  };
}
