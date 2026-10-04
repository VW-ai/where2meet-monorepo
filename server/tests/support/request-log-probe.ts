import { makeApp } from "../../src/app.js";

const app = await makeApp({ environment: "development", logLevel: "info" });
try {
  const response = await app.inject({
    url: "/health?token=synthetic-query-secret",
    headers: {
      authorization: "Bearer synthetic-authorization-secret",
      cookie: "session_token=synthetic-cookie-secret",
    },
  });
  if (response.statusCode !== 200) throw new Error("Log probe request failed");
} finally {
  await app.close();
}
