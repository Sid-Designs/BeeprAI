import {
  generateAccessToken,
  generateRawToken,
  hashToken,
  buildTokenPayload,
} from "./auth.service.js";

const MAX_REFRESH_TOKENS = 5;
const REFRESH_TOKEN_EXPIRY_MS =
  (parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || "7", 10)) * 24 * 60 * 60 * 1000;

export async function issueTokenPair(user, userAgent = "") {
  const rawRefreshToken = generateRawToken(64);
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await pruneExpiredTokens(user);

  // Keep only the most recent MAX_REFRESH_TOKENS - 1 before adding the new one
  if (user.refreshTokens.length >= MAX_REFRESH_TOKENS) {
    user.refreshTokens = user.refreshTokens
      .sort((a, b) => b.expiresAt - a.expiresAt)
      .slice(0, MAX_REFRESH_TOKENS - 1);
  }

  user.refreshTokens.push({ tokenHash, expiresAt, userAgent });
  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = generateAccessToken(buildTokenPayload(user));

  return { accessToken, rawRefreshToken };
}

export async function rotateRefreshToken(user, oldRawToken, userAgent = "") {
  const oldHash = hashToken(oldRawToken);
  const tokenIndex = user.refreshTokens.findIndex(
    (t) => t.tokenHash === oldHash,
  );

  if (tokenIndex === -1) {
    // Token not found — either expired, already used, or stolen.
    // Revoke all sessions as a precaution against token theft.
    user.refreshTokens = [];
    await user.save();
    return null;
  }

  user.refreshTokens.splice(tokenIndex, 1);

  const rawRefreshToken = generateRawToken(64);
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  user.refreshTokens.push({ tokenHash, expiresAt, userAgent });
  await user.save();

  const accessToken = generateAccessToken(buildTokenPayload(user));

  return { accessToken, rawRefreshToken };
}

export async function revokeRefreshToken(user, rawToken) {
  const tokenHash = hashToken(rawToken);
  user.refreshTokens = user.refreshTokens.filter(
    (t) => t.tokenHash !== tokenHash,
  );
  await user.save();
}

export async function revokeAllRefreshTokens(user) {
  user.refreshTokens = [];
  await user.save();
}

async function pruneExpiredTokens(user) {
  const now = new Date();
  user.refreshTokens = user.refreshTokens.filter((t) => t.expiresAt > now);
}
