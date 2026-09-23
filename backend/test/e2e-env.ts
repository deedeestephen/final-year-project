// Environment for gateway e2e tests. Database URLs point at closed ports and are
// never contacted: PrismaService and MongoService are replaced by fakes.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://e2e:e2e@127.0.0.1:1/e2e',
  MONGO_URL: 'mongodb://e2e:e2e@127.0.0.1:1/e2e',
  CORS_ORIGINS: 'https://app.example.test',
  JSON_BODY_LIMIT: '1kb',
  RATE_LIMIT_MAX: '20',
  RATE_LIMIT_TTL_MS: '60000',
});
