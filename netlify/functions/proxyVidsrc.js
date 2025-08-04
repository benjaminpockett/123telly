import fetch from "node-fetch";
import * as cheerio from "cheerio";

export async function handler(event) {
  const { type, id, season, episode } = event.queryStringParameters;
  if (!type || !id) return { statusCode: 400, body: "Missing parameters" };

  let url = `https://vidsrc.to/embed/${type}/${id}`;
  if (type === "tv" && season && episode) url += `/${season}/${episode}`;

  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove ads and popups
    $(".ad-container, .ads, .popups, .sponsor, #ads").remove();

    // Filter out ad scripts but keep essential player scripts
    $("script").each((_, el) => {
      const src = $(el).attr("src") || "";
      const content = $(el).html() || "";

      if (
        src.includes("ads") ||
        src.includes("tracker") ||
        content.includes("adProvider") ||
        content.includes("popup")
      ) {
        $(el).remove();
      }
    });

    // Optionally inject CSS to hide remaining unwanted elements dynamically
    $("head").append("<style>.ad-container, .ads, .popups { display:none!important; }</style>");

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: $.html(),
    };
  } catch (err) {
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
}
