// The validated settings (the secret is checked there: it must exist and be long enough)
import { env } from "../config/env.js";
// jsonwebtoken = the library that creates (sign) and checks (verify) JWTs (JSON Web Tokens)
import jwt from "jsonwebtoken";

// The secret key proves a token was really made by our server (config/env.ts already guarantees it is long enough)
const secret = env.JWT_SECRET;

// How long a token stays valid, in seconds (60 sec * 60 min * 24 hours * 7 days = 7 days)
const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

// Create a token for a user; the token carries ONLY the user id (roles are looked up fresh from the DB)
export function signToken(userId: string): string {
  // The payload is empty; "subject" (the standard "sub" claim) holds who the token belongs to
  return jwt.sign({}, secret, {
    // "subject" = the user this token represents
    subject: userId,
    // "expiresIn" = after this many seconds the token stops working
    expiresIn: TOKEN_LIFETIME_SECONDS,
    // HS256 = HMAC-SHA256, a signing method that uses one shared secret key
    algorithm: "HS256",
  });
}

// Check a token and return the user id inside it; throws an error if the token is fake, edited or expired
export function verifyToken(token: string): string {
  // verify() recomputes the signature and checks the expiry; we only allow HS256 so nobody can swap the algorithm
  const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  // verify() can return a plain string or an object; we need an object that has a "sub" (user id)
  if (typeof payload === "string" || !payload.sub) {
    // Reject anything that does not look like a token we created
    throw new Error("Invalid token payload");
  }
  // Hand back the user id so the caller knows who is making the request
  return payload.sub;
}
