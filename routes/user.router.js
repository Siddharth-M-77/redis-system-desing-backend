import express from "express";
import {
  claimEarnings,
  getAllHelpAndSupportHistory,
  getAllMonthlyRewardsHistory,
  getAllPlan,
  getAllTeamRewardsHistory,
  getBinaryTree,
  getDepositAddress,
  getInvestmentHistoryById,
  getLevelIncomeHistory,
  getProfile,
  getreferalHistoryByID,
  getRoiIncomeHistory,
  getSalaryIncomeHistory,
  getTeamBusiness,
  getUsersCountByLevel,
  helpAndSupport,
  investment,
  userLogin,
  userLogout,
  userRegister,
  withdrawalHistory,
} from "../controllers/user.controller.js";
import IsAuthenticated from "../middlewares/IsAuthenticated.js";
import { getBanners } from "../controllers/admin.controller.js";
import { calculateRoi } from "../utils/distributeDailyROI.js";
import industryCache from "../middlewares/userAndAdminCache.js";
import { invalidateAdminOnUserAction } from "../middlewares/invalidateAdminOnUserAction.js";
import invalidateCache from "../middlewares/invalidateUserCache.js";
import { requestWithdrawal } from "../utils/withdrawalProcessor.js";
const router = express.Router();
router.route("/login").post(userLogin);
router.use(invalidateAdminOnUserAction);
router.route("/register").post(userRegister);
router.get("/get-banners", getBanners);
router.route("/get-packages").get(industryCache(3600), getAllPlan);
router.use(IsAuthenticated);
router.use(invalidateCache);
router.route("/logout").post(userLogout);
router.route("/get-Profile").get(industryCache(1800), getProfile);
router.route("/getRoi-history").get(industryCache(1800), getRoiIncomeHistory);
router
  .route("/getLevelIncome-history")
  .get(industryCache(1800), getLevelIncomeHistory);
router
  .route("/investment-history")
  .get(industryCache(1800), getInvestmentHistoryById);
router.route("/get-binary").get(industryCache(1800), getBinaryTree);
router
  .route("/getreferal-history")
  .get(industryCache(1800), getreferalHistoryByID);
router.route("/getLevelUsers").get(industryCache(1800), getUsersCountByLevel);
router
  .route("/support/messages")
  .get(industryCache(1800), getAllHelpAndSupportHistory);
router.get("/withdrawals-history", industryCache(1800), withdrawalHistory);
router.get(
  "/monthlyIncome-history",
  industryCache(1800),
  getAllMonthlyRewardsHistory,
);
router.get(
  "/teamReward-history",
  industryCache(1800),
  getAllTeamRewardsHistory,
);
router.route("/team-business").get(industryCache(1800), getTeamBusiness);
router
  .route("/get-salary-history")
  .get(industryCache(360), getSalaryIncomeHistory);
router.route("/buy-package").post(investment);
router.route("/support/create").post(helpAndSupport);
router.route("/withdrawal-request").post(requestWithdrawal);
router.post("/roi/cal", calculateRoi);
router.post("/claim-roi", claimEarnings);
router.get("/get-deposit-address", getDepositAddress);

export default router;
