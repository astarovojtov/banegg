const jwt = require("jsonwebtoken");

const config = {
  TOKEN_KEY: "s0m3-rand-0mt0-k3nn",
};

const verifyToken = (req, res, next) => {
  const token =
    req.body.token || req.query.token || req.headers["x-access-token"];

  if (!token) {
    return res.status(403).json({ error: "A token is required" });
  }
  try {
    const decoded = jwt.verify(token, config.TOKEN_KEY);
    req.user = decoded;
  } catch (err) {
    return res.status(401).json({ error: "Invalid Token" });
  }
  return next();
};

module.exports = verifyToken;
