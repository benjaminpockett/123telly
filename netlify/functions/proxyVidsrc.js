const fetch = require('node-fetch');

exports.handler = async function(event) {
  const { url } = event.queryStringParameters || {};

  if (!url) {
    return {
      statusCode: 400,
      body: 'Missing "url" parameter',
    };
  }

  try {
    // Validate URL (basic)
    const validatedUrl = new URL(url);

    // Fetch the page
    const response = await fetch(validatedUrl.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: `Failed to fetch URL: ${response.statusText}`,
      };
    }

    const html = await response.text();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: html,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: `Error: ${error.message}`,
    };
  }
};
