// express-rate-limit = a middleware that counts requests per client and blocks those that make too many
import rateLimit from "express-rate-limit";

// Build a rate limiter; a function (factory) so tests can create one with tiny limits
export function buildRateLimiter(options: { max: number; windowMs: number; skipSuccessfulRequests?: boolean }) {
  // Create the middleware
  return rateLimit({
    // The length of the counting window, in milliseconds
    windowMs: options.windowMs,
    // How many requests one client (IP address) may make inside the window
    limit: options.max,
    // true = only FAILED requests (status 400 and above) count; good for logins, so real users are never locked out by their own successes
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    // Send the standard "RateLimit" headers so clients can see how many attempts remain
    standardHeaders: "draft-7",
    // Do not send the older X-RateLimit-* headers
    legacyHeaders: false,
    // The JSON body sent with the 429 (Too Many Requests) status, in the same shape as our other errors
    message: { success: false, message: "Too many attempts. Please try again later." },
  });
}
