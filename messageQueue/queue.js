// config/queue.js
import { Queue } from "bullmq";
import { bullConnection } from "../config/queueConnection.js";
import { QUEUE_NAMES } from "./queueNames.js";

const baseOptions = {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
};

export const referralQueue = new Queue(
  QUEUE_NAMES.REFERRAL_DISTRIBUTION,
  baseOptions,
);

export const withdrawalQueue = new Queue(QUEUE_NAMES.WITHDRAWAL_PROCESSING, {
  ...baseOptions,
  defaultJobOptions: {
    ...baseOptions.defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});
