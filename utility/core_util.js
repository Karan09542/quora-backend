const cors = require("cors");
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:5173",
];
export const corsWithCredentials = core({
  origin: allowedOrigins,
  credentials: true, // Allow credentials (cookies, Authorization headers, etc.)
});

// CORS configuration for routes without credentials
export const corsWithoutCredentials = core({
  origin: allowedOrigins,
  credentials: false, // No credentials allowed
});
