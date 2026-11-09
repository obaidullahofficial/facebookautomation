const express = require("express");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || "http://129.225.93.30:8080";

// Proxy API requests to Oracle backend
app.use(
  "/api",
  createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
  })
);

// Proxy generated images to Oracle backend
app.use(
  "/generated",
  createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
  })
);

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}, proxying to ${BACKEND_URL}`);
});
