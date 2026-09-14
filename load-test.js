import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 100,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

// Ye function test start hone se PEHLE ek baar chalta hai
export function setup() {
  const res = http.get("http://localhost:6002/api/users/get-Profile", {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
  });
  console.log("Cache warm-up status:", res.status);
}

export default function () {
  const res = http.get("http://localhost:6002/api/users/get-Profile", {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
  });

  check(res, {
    "status 200 hai": (r) => r.status === 200,
    "fast response hai": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
