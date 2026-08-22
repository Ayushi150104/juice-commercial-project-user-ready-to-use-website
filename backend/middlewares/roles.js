/**
 * middlewares/roles.js
 * Purpose: role-based access control. Use after requireAuth.
 *   router.get("/", requireAuth, requireRole("admin"), handler)
 */
const ApiError = require("../utils/ApiError");

const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden("You do not have permission for this action", {
          code: "FORBIDDEN_ROLE",
        })
      );
    }
    next();
  };

module.exports = { requireRole };
