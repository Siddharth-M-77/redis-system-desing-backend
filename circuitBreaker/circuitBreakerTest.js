// circuitBreaker/realApiCircuitBreaker.js

import axios from "axios";
import CircuitBreaker from "opossum";

// ==========================================
// REAL PUBLIC API — httpbin.org
// Ye ek real, trusted testing API hai jo Postman/developers use karte hain
// ==========================================
const API_SUCCESS_URL = "https://httpbin.org/status/200";
const API_FAIL_URL = "https://httpbin.org/status/500";

// ==========================================
// RAW FETCH FUNCTION — Jaise tera fetchTrendApiResult() hai
// ==========================================
async function _fetchRealApiRaw(url) {
  const response = await axios.get(url, { timeout: 3000 });

  if (response.status !== 200) {
    throw new Error(`API returned status ${response.status}`);
  }

  return { status: response.status, success: true };
}

// ==========================================
// CIRCUIT BREAKER SETUP
// ==========================================
const apiBreaker = new CircuitBreaker(_fetchRealApiRaw, {
  timeout: 3500,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  volumeThreshold: 3,
});

apiBreaker.on("open", () =>
  console.log("🔴 EVENT: Circuit OPEN — API baar baar fail ho rahi hai"),
);
apiBreaker.on("halfOpen", () =>
  console.log("🟡 EVENT: Circuit HALF-OPEN — test request bhej rahe hain"),
);
apiBreaker.on("close", () =>
  console.log("🟢 EVENT: Circuit CLOSED — API normal ho gayi"),
);
apiBreaker.on("reject", () =>
  console.log(
    "⚠️ EVENT: Request REJECTED (circuit abhi OPEN hai, real API call nahi hui)",
  ),
);

apiBreaker.fallback(() => ({ __isFallback: true }));

// ==========================================
// PUBLIC FUNCTION — Yahi tera real usage pattern hai
// ==========================================
async function fetchWithBreaker(url) {
  try {
    return await apiBreaker.fire(url);
  } catch (error) {
    return { __isFallback: true, error: error.message };
  }
}

function printState(label) {
  console.log(
    `   [${label}] Opened: ${apiBreaker.opened} | Closed: ${apiBreaker.closed} | HalfOpen: ${apiBreaker.halfOpen}`,
  );
}

function logResult(callLabel, result, timeTaken) {
  const isFallback = result?.__isFallback === true;
  const label = isFallback ? "🟠 FALLBACK" : "✅ REAL SUCCESS";
  console.log(`Call ${callLabel} → Time: ${timeTaken}ms | ${label}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// TEST RUN — Real API ke saath
// ==========================================
async function runTests() {
  console.log(
    "\n========== TEST 1: Real Success Calls (httpbin.org/status/200) ==========",
  );
  for (let i = 1; i <= 3; i++) {
    const start = Date.now();
    const result = await fetchWithBreaker(API_SUCCESS_URL);
    logResult(i, result, Date.now() - start);
    printState(`After Call ${i}`);
    await sleep(500);
  }

  console.log(
    "\n========== TEST 2: Real Failing API (httpbin.org/status/500) ==========",
  );
  for (let i = 1; i <= 6; i++) {
    const start = Date.now();
    const result = await fetchWithBreaker(API_FAIL_URL);
    logResult(i, result, Date.now() - start);
    printState(`After Call ${i}`);
    await sleep(500);
  }

  console.log(
    "\n========== TEST 3: Circuit OPEN — Turant Reject Hona Chahiye ==========",
  );
  const start = Date.now();
  const result = await fetchWithBreaker(API_FAIL_URL);
  logResult("Test3", result, Date.now() - start);
  printState("Test 3");

  console.log(
    "\n========== TEST 4: Recovery — Real Success URL Try Karenge ==========",
  );
  console.log("⏳ 11 second wait (resetTimeout cross karne ke liye)...");
  await sleep(11000);
  printState("Before Recovery");

  const recStart = Date.now();
  const recoveryResult = await fetchWithBreaker(API_SUCCESS_URL);
  logResult("Recovery", recoveryResult, Date.now() - recStart);
  printState("After Recovery");

  console.log("\n✅ Tests complete!");
}

runTests();
