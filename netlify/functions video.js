const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  const { authorization } = event.headers;
  const VALID_PASSWORD = 'secret123'; // Change to use env var in production

  if (authorization !== `Bearer ${VALID_PASSWORD}`) {
    return {
      statusCode: 401,
      body: 'Unauthorized',
    };
  }

  const filePath = path.join(__dirname, '../../private-ts/myvideo.mp4');

  if (!fs.existsSync(filePath)) {
    return {
      statusCode: 404,
      body: 'File not found',
    };
  }

  const fileBuffer = fs.readFileSync(filePath);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'no-store',
    },
    body: fileBuffer.toString('base64'),
    isBase64Encoded: true,
  };
};
