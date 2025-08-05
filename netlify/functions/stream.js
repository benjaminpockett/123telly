const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  const { authorization } = event.headers;
  const VALID_PASSWORD = 'secret123'; // Use environment variable in real apps

  if (authorization !== `Bearer ${VALID_PASSWORD}`) {
    return {
      statusCode: 401,
      body: 'Unauthorized',
    };
  }

  const filename = event.queryStringParameters?.file;
  if (!filename || !/^[\w\-\.]+\.ts$/.test(filename)) {
    return {
      statusCode: 400,
      body: 'Invalid file name',
    };
  }

  const filePath = path.join(__dirname, '../../private-ts/', filename);
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
      'Content-Type': 'video/MP2T',
      'Cache-Control': 'no-store',
    },
    body: fileBuffer.toString('base64'),
    isBase64Encoded: true,
  };
};
