// Apollo Server setup + Express mount.
//
// This coexists with the REST API: it adds a single POST/GET /graphql endpoint
// and reuses the app-level middleware (CORS, helmet, body parser, rate limit,
// ensureDBConnected) already applied in server.js.
//
// Serverless note: Apollo requires `await server.start()` before its middleware
// can handle requests. We can't top-level `await` in CommonJS, so we kick off
// start() once at module load and gate every request behind that promise. This
// works for both `node server.js` and the serverless wrapper (api/index.js).
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@as-integrations/express4");
const { graphqlUploadExpress } = require("graphql-upload-minimal");
const typeDefs = require("./typeDefs");
const resolvers = require("./resolvers");
const buildContext = require("./context");

const server = new ApolloServer({ typeDefs, resolvers });

let handler;
const startPromise = server
  .start()
  .then(() => {
    handler = expressMiddleware(server, { context: buildContext });
    console.log("GraphQL ready at /graphql");
  })
  .catch((err) => {
    console.error("Failed to start Apollo Server:", err.message || err);
    throw err;
  });

const mountGraphQL = (app) => {
  app.use(
    "/graphql",
    // Parse multipart/form-data uploads (graphql-multipart-request-spec).
    // Passes through non-multipart requests untouched.
    graphqlUploadExpress({ maxFileSize: 5 * 1024 * 1024, maxFiles: 1 }),
    (req, res, next) => {
      startPromise.then(() => handler(req, res, next)).catch(next);
    },
  );
};

module.exports = mountGraphQL;
