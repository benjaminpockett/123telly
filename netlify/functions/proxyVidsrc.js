const fetch = require("node-fetch");
const cheerio = require("cheerio");

exports.handler = async function (event) {
  const { type, id, season, episode } = event.queryStringParameters || {};
  if (!type || !id) return { statusCode: 400, body: "Missing parameters" };

  let url = `https://vidsrc.to/embed/${type}/${id}`;
  if (type === "tv" && season && episode) url += `/${season}/${episode}`;

  try {
    // STEP 1: Fetch main Vidsrc page
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await response.text();
    const $ = cheerio.load(html);

    // STEP 2: Extract iframe src
    const iframeSrc = $("iframe").attr("src");
    if (!iframeSrc) {
      return {
        statusCode: 500,
        body: "Could not find iframe in Vidsrc page",
      };
    }

    // STEP 3: Fetch iframe content
    const iframeUrl = iframeSrc.startsWith("http") ? iframeSrc : `https:${iframeSrc}`;
    const iframeResponse = await fetch(iframeUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const iframeHtml = await iframeResponse.text();
    const iframe$ = cheerio.load(iframeHtml);

    // STEP 4: Remove ALL scripts and ad containers
    iframe$("script").remove();
    iframe$(".ad-container, .ads, .popups, .sponsor, #ads").remove();
    iframe$("head").append("<style>.ad-container, .ads, .popups, .sponsor, #ads { display:none!important; }</style>");

    // STEP 5: Return the cleaned iframe content
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: iframe$.html(),
    };
  } catch (err) {
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
};
