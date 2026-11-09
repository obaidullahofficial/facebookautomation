const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || "https://api.fluxpropel.com";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Direct proxy for /api/* to Oracle VPS Nginx (/fb-api/*)
app.use("/api", async (req, res) => {
  const targetUrl = `${BACKEND_URL}/fb-api${req.url}`;
  try {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;

    const init = {
      method: req.method,
      headers: {
        ...headers,
        "content-type": req.headers["content-type"] || "application/json",
      },
    };

    if (!["GET", "HEAD"].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      init.body = JSON.stringify(req.body);
    }

    const resp = await fetch(targetUrl, init);
    res.status(resp.status);
    resp.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (lower !== "content-encoding" && lower !== "transfer-encoding") {
        res.setHeader(key, val);
      }
    });
    const buffer = await resp.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("[Proxy Error]", err.message);
    res.status(502).json({
      success: false,
      error: `Proxy failed to connect to Oracle VPS (${BACKEND_URL}): ${err.message}`,
    });
  }
});

// Direct proxy for /generated/* (images)
app.use("/generated", async (req, res) => {
  const targetUrl = `${BACKEND_URL}/generated${req.url}`;
  try {
    const resp = await fetch(targetUrl);
    res.status(resp.status);
    resp.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (lower !== "content-encoding" && lower !== "transfer-encoding") {
        res.setHeader(key, val);
      }
    });
    const buffer = await resp.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(404).send("Image not found");
  }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}, backend at ${BACKEND_URL}`);
});
