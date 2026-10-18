import dotenv from "dotenv";

// Imported first in server.ts so the variables exist before db.ts builds the
// pool. Local dev reads the .env at the repo root. In Docker, the variables
// come from Compose, and a missing file here is ignored.
dotenv.config({ path: "../.env" });
