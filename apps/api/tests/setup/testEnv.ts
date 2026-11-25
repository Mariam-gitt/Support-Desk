// Load the .env file so TEST_DATABASE_URL can live there next to your other settings
import "dotenv/config";

// Point the app at the TEST database and make every other setting predictable (called before the app is imported)
export function applyTestEnv() {
  // The URL of the database used ONLY for tests
  const testUrl = process.env.TEST_DATABASE_URL;
  // Refuse to run without it, with instructions
  if (!testUrl) {
    // Stop with a message that explains the fix
    throw new Error(
      "TEST_DATABASE_URL is not set. Create a SEPARATE empty database (its name must contain \"test\", e.g. support_desk_test), " +
        "and put its connection string in .env as TEST_DATABASE_URL. Tests empty this database on every run.",
    );
  }
  // Extract the database name from the URL (the part after the last slash)
  const databaseName = new URL(testUrl).pathname.replace(/^\//, "");
  // SAFETY: tests delete all data, so refuse any database whose name does not contain "test"
  if (!/test/i.test(databaseName)) {
    // Stop before anything can be deleted
    throw new Error(`Refusing to run tests: database "${databaseName}" does not look like a test database (its name must contain "test").`);
  }
  // From now on the whole app uses the test database
  process.env.DATABASE_URL = testUrl;
  // A valid (32+ character) secret just for tests
  process.env.JWT_SECRET = "test-secret-for-automated-tests-only-0123456789";
  // Empty values switch the optional features OFF (dotenv never overwrites a variable that already exists, even an empty one)
  process.env.REDIS_URL = "";
  // No cross-site origins in tests
  process.env.CORS_ORIGIN = "";
  // No simulated failures in tests
  process.env.SIMULATE_NOTIFY_FAILURES = "0";
  // Effectively no rate limiting in general tests (the limiter itself is tested separately with tiny limits)
  process.env.AUTH_RATE_LIMIT_MAX = "100000";
  // The cheapest allowed password hashing, so tests run fast
  process.env.BCRYPT_ROUNDS = "4";
}
