import path from "node:path";
import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { countRequests } from "./metrics.js";

// Builds the app without starting the server, so tests can use it directly.
// When STATIC_DIR is set (in Docker), it also serves the built website.
export function createApp({ staticDir = process.env.STATIC_DIR } = {}) {
  const app = express();

  // Only the frontend address in CORS_ORIGIN may call the API from a browser.
  // Several addresses can be given, separated by commas.
  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((o) => o.trim());

  // Count every request for Prometheus (served on a separate port)
  app.use(countRequests);

  app.use(cors({ origin: allowedOrigins }));

  app.use(express.json());

  app.use("/api", routes);

  if (staticDir) {
    const dir = path.resolve(staticDir);
    app.use(express.static(dir));
    // Pages like /items/3 are handled by React Router, so send index.html
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) return next();
      res.sendFile(path.join(dir, "index.html"));
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  // Bad JSON in a request body, or any other error
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({ error: status === 500 ? "Something went wrong" : err.message });
  });

  return app;
}
