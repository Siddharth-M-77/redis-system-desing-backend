import cron from "node-cron";
import {
  runSalaryRankCron,
  settleDueRewards,
} from "../controllers/Salary.controller.js";
const TZ = "Asia/Kolkata";
let isSalaryRankProcessing = false;
let isRewardSettleProcessing = false;
const guarded = (name, flagGetter, flagSetter, fn) => async () => {
  if (flagGetter()) {
    console.log(`[cron:${name}] already running, skip`);
    return;
  }
  flagSetter(true);
  const start = Date.now();
  try {
    await fn();
  } catch (err) {
    console.error(`[cron:${name}] error:`, err);
  } finally {
    flagSetter(false);
    console.log(`[cron:${name}] done in ${Date.now() - start}ms`);
  }
};
cron.schedule(
  "0 1 * * *",
  guarded(
    "salary-rank",
    () => isSalaryRankProcessing,
    (v) => (isSalaryRankProcessing = v),
    runSalaryRankCron,
  ),
  { timezone: TZ },
);

cron.schedule(
  "30 1 * * *",
  guarded(
    "reward-settle",
    () => isRewardSettleProcessing,
    (v) => (isRewardSettleProcessing = v),
    settleDueRewards,
  ),
  { timezone: TZ },
);

console.log("[cron] salary + reward schedulers registered");
