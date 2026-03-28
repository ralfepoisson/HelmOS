const DEV_AUTH_SERVICE_APPLICATION_ID = "04adc1d7-7475-4b28-67b2-63e24308a786";

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getAuthServiceSignInUrl() {
  return (
    process.env.AUTH_SERVICE_SIGN_IN_URL?.trim() ||
    process.env.FRONTEND_AUTH_SERVICE_SIGN_IN_URL?.trim() ||
    "http://auth-service.localhost:46138/"
  );
}

function getAuthServiceApplicationId() {
  return (
    process.env.AUTH_SERVICE_APPLICATION_ID?.trim() ||
    process.env.FRONTEND_AUTH_SERVICE_APPLICATION_ID?.trim() ||
    DEV_AUTH_SERVICE_APPLICATION_ID
  );
}

function isTruthyBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return false;
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== "string") {
    throw createHttpError(401, "Authentication is required");
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2);
  if (scheme !== "Bearer" || !token) {
    throw createHttpError(401, "Authentication is required");
  }

  return token;
}

function coerceClaimValue(payload, keys) {
  for (const key of keys) {
    const value = payload?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return `${value}`;
    }
  }

  return null;
}

function parseAdminEmails(value) {
  const configured = `${value ?? ""}`
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return configured.length > 0 ? configured : ["ralfepoisson@gmail.com"];
}

function parseJwtClaims(token) {
  const segments = token.split(".");
  if (segments.length < 2) {
    throw createHttpError(401, "Authentication is required");
  }

  let header;
  let payload;
  try {
    header = JSON.parse(decodeBase64Url(segments[0]));
    payload = JSON.parse(decodeBase64Url(segments[1]));
  } catch {
    throw createHttpError(401, "Authentication is required");
  }

  const userId = coerceClaimValue(payload, ["userid", "userId", "sub"]);
  const accountId = coerceClaimValue(payload, ["accountId", "accountid", "tenantId", "tenantid"]);
  const exp = Number(payload?.exp);
  const nbf = payload?.nbf == null ? null : Number(payload.nbf);
  const now = Math.floor(Date.now() / 1000);

  if (!userId || !accountId || !Number.isFinite(exp) || exp <= now || (Number.isFinite(nbf) && nbf > now)) {
    throw createHttpError(401, "Authentication is required");
  }

  return {
    header,
    claims: payload,
    userId,
    accountId,
    email:
      coerceClaimValue(payload, ["email"]) ??
      `${userId.replace(/[^a-z0-9._-]+/gi, "-")}@life2.local`,
    displayName: coerceClaimValue(payload, ["displayName", "name"]),
    avatarUrl: coerceClaimValue(payload, ["avatarUrl", "picture"]),
    timezone: coerceClaimValue(payload, ["timezone"]),
    locale: coerceClaimValue(payload, ["locale"]),
    isAdminCapable: isTruthyBoolean(payload?.isAdmin),
  };
}

function createAuthMiddleware({ prisma, adminEmails = process.env.ADMIN_EMAILS }) {
  const adminEmailSet = new Set(parseAdminEmails(adminEmails));

  return async (req, _res, next) => {
    try {
      const token = extractBearerToken(req.headers.authorization);
      const parsed = parseJwtClaims(token);
      verifyJwtSignature(token, parsed.header);
      const appRole = await deriveAppRole(prisma, parsed, adminEmailSet);
      const currentUser =
        typeof prisma.user?.upsert === "function"
          ? await prisma.user.upsert({
              where: {
                email: parsed.email,
              },
              update: {
                displayName: parsed.displayName ?? undefined,
                avatarUrl: parsed.avatarUrl ?? undefined,
                life2AccountId: parsed.accountId,
                authProvider: "life2",
                authProviderUserId: parsed.userId,
                isActive: true,
                lastSeenAt: new Date(),
                appRole,
              },
              create: {
                email: parsed.email,
                displayName: parsed.displayName ?? null,
                avatarUrl: parsed.avatarUrl ?? null,
                life2AccountId: parsed.accountId,
                authProvider: "life2",
                authProviderUserId: parsed.userId,
                isActive: true,
                lastSeenAt: new Date(),
                appRole,
              },
            })
          : {
              id: parsed.userId,
              email: parsed.email,
              displayName: parsed.displayName ?? null,
              avatarUrl: parsed.avatarUrl ?? null,
              authProvider: "life2",
              authProviderUserId: parsed.userId,
              isActive: true,
              appRole,
            };

      req.auth = {
        token,
        tenantId: parsed.accountId,
        claims: parsed.claims,
        userId: parsed.userId,
        displayName: parsed.displayName,
        timezone: parsed.timezone,
        locale: parsed.locale,
        email: parsed.email,
        isAdmin: (currentUser?.appRole ?? appRole) === "ADMIN",
        currentUser: {
          ...currentUser,
          appRole: currentUser?.appRole ?? appRole,
        },
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

function verifyJwtSignature(token, header) {
  const secret = process.env.LIFE2_JWT_SECRET?.trim();
  const publicKey = process.env.LIFE2_JWT_PUBLIC_KEY?.trim();

  if (!secret && !publicKey) {
    return;
  }

  const [encodedHeader, encodedPayload, encodedSignature = ""] = token.split(".");
  const algorithm = header?.alg;
  const input = `${encodedHeader}.${encodedPayload}`;

  if (secret) {
    if (algorithm !== "HS256") {
      throw createHttpError(401, "Authentication is required");
    }

    const crypto = require("node:crypto");
    const expected = crypto.createHmac("sha256", secret).update(input).digest("base64url");
    if (expected !== encodedSignature) {
      throw createHttpError(401, "Authentication is required");
    }
    return;
  }

  if (algorithm !== "RS256") {
    throw createHttpError(401, "Authentication is required");
  }

  const crypto = require("node:crypto");
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(input);
  verifier.end();

  if (!verifier.verify(publicKey, encodedSignature, "base64url")) {
    throw createHttpError(401, "Authentication is required");
  }
}

async function deriveAppRole(prisma, parsed, adminEmailSet) {
  if (adminEmailSet.has(parsed.email.toLowerCase())) {
    return "ADMIN";
  }

  if (!parsed.isAdminCapable || typeof prisma.user?.count !== "function") {
    return "USER";
  }

  const existingAdminCount = await prisma.user.count({
    where: {
      life2AccountId: parsed.accountId,
      appRole: "ADMIN",
    },
  });

  return existingAdminCount === 0 ? "ADMIN" : "USER";
}

function requireAdmin(req, _res, next) {
  if (req.auth?.currentUser?.appRole !== "ADMIN") {
    return next(createHttpError(403, "Admin access is required"));
  }

  return next();
}

function createAuthServiceSignInHandler() {
  return (req, res, next) => {
    const redirectTarget = typeof req.query.redirect === "string" ? req.query.redirect.trim() : "";
    const applicationId = getAuthServiceApplicationId();

    if (!redirectTarget) {
      return next(createHttpError(400, "A redirect target is required"));
    }

    if (!applicationId) {
      return next(createHttpError(500, "AUTH_SERVICE_APPLICATION_ID is not configured"));
    }

    try {
      const signInUrl = new URL(getAuthServiceSignInUrl());
      signInUrl.searchParams.set("applicationId", applicationId);
      signInUrl.searchParams.set("redirect", redirectTarget);
      return res.redirect(302, signInUrl.toString());
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  createAuthServiceSignInHandler,
  createAuthMiddleware,
  createHttpError,
  parseAdminEmails,
  requireAdmin,
};
