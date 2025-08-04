import movies from '../../movies.json' assert { type: 'json' };

export const handler = async (event) => {
  const query = event.queryStringParameters.q || '';
  const search = query.toLowerCase();

  const results = movies.filter(movie =>
    movie.title.toLowerCase().includes(search)
  );

  return {
    statusCode: 200,
    body: JSON.stringify(results)
  };
};
