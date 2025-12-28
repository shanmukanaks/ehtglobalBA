import passport from "../passport.js";

// middleware to check if user is authenticated via jwt
export function isAuthenticated(req, res, next) {
  passport.authenticate("jwt", { session: false }, (err, user) => {
    if (err) {
      console.error("auth error:", err);
      return res.status(500).json({ error: "something went wrong" });
    }

    if (!user) {
      return res.status(401).json({ error: "not authenticated" });
    }

    req.user = user;
    next();
  })(req, res, next);
}

// middleware to check if user has specific role(s)
export function hasRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "not authorized" });
    }

    next();
  };
}

// combined middleware: authenticate + check role
export function requireRole(...roles) {
  return [isAuthenticated, hasRole(...roles)];
}

// optional auth sets req.user if token present but doesn't require it
export function optionalAuth(req, res, next) {
  passport.authenticate("jwt", { session: false }, (err, user) => {
    if (user) {
      req.user = user;
    }
    next();
  })(req, res, next);
}
