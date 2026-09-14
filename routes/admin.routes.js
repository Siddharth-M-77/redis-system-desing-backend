import express from "express";
import {
  addWalletAddress,
  adminLogin,
  adminRegister,
  adminTopupInvestment,
  allUsers,
  allWithdrwal,
  deleteBanner,
  getAllIncomes,
  getAllMessage,
  getAllReferalBonus,
  getAllUsers,
  getBanners,
  getDailyRoi,
  getKey,
  getLevelIncomeHistory,
  getOneTimeTeamRewardsHistory,
  getProfile,
  getRoiHistory,
  getSalaryIncomeHistory,
  getTotalInvestedUsers,
  getUserInfo,
  getWalletAddress,
  monthlyIncomeHistory,
  setPrivateKey,
  ticketApprove,
  ticketReject,
  toggleUserLogin,
  toggleWithdrawalAccess,
  updateGlobalLimit,
  uploadBanner,
} from "../controllers/admin.controller.js";
import { createPlan } from "../controllers/plan.controller.js";
import { isAdminAuthenticated } from "../middlewares/adminMiddleware.js";
import bannerUpload from "../utils/multer.js";

// Middlewares Import
import industryCache from "../middlewares/userAndAdminCache.js";
import invalidateAdminCache from "../middlewares/invalidateAdminCache.js";
import {
  approveAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
} from "../utils/withdrawalProcessor.js";

const router = express.Router();

// ==========================================
// 🔓 PUBLIC ROUTES (No Auth, No Admin Cache)
// ==========================================
router.route("/register").post(adminRegister);
router.route("/login").post(adminLogin);
router.get("/get-banners", industryCache(3600), getBanners); // Static banner data, non-auth users bhi dekh sakte hain

// ==========================================
// 🛡️ GLOBAL ADMIN GATEWAYS (Sabhi Private Routes Ke Liye)
// ==========================================
// 1. Iske niche ke saare routes automatic check honge ki banda admin hai ya nahi
router.use(isAdminAuthenticated);

// 2. Iske niche jab bhi koi POST/PUT/DELETE ya custom action hoga, admin cache automatic saaf!
router.use(invalidateAdminCache);

// ==========================================
// 📊 ADMIN GET REPORTS (Smart Cached ⚡)
// ==========================================
// Profile details: 5 mins cache
router.route("/getProfile").get(industryCache(300), getProfile);

// Real-time dynamic reports: 1 min cache (60 seconds) for ultimate sync!
router.route("/getAllUsers").get(industryCache(60), allUsers);
router.route("/all-users").get(industryCache(60), getAllUsers);
router.route("/getAllIncomes").get(industryCache(60), getAllIncomes);
router.route("/withdrawal-reports").get(industryCache(60), allWithdrwal);
router
  .route("/getAllInvestedUsers")
  .get(industryCache(60), getTotalInvestedUsers);

// History logs: 5 mins cache (300 seconds)
router.route("/getAllRoi-history").get(industryCache(300), getDailyRoi);
router.route("/get-roi-history").get(industryCache(300), getRoiHistory);
router
  .route("/getAllReferalBonus-history")
  .get(industryCache(300), getAllReferalBonus);
router
  .route("/getAllLevelIncome-history")
  .get(industryCache(300), getLevelIncomeHistory);
router
  .route("/admin-monthlyIncome-history")
  .get(industryCache(300), monthlyIncomeHistory);
router
  .route("/get-adminTeamReward-history")
  .get(industryCache(300), getOneTimeTeamRewardsHistory);
router
  .route("/get-salary-history")
  .get(industryCache(300), getSalaryIncomeHistory);

// Support Desk: 30 seconds cache taaki tickets jaldi-jaldi update hon
router.route("/support-in-process").get(industryCache(30), getAllMessage);

// ==========================================
// 🛠️ ADMIN WRITE/ACTION ROUTES (No Repetitive Middlewares 🚀)
// ==========================================
// Support Tickets Approval/Rejection
router.post("/support/status/approve/:ticketId", ticketApprove);
router.post("/support/status/reject/:ticketId", ticketReject);
router.post("/withdrwal-limit", updateGlobalLimit);
router.route("/create-plan").post(createPlan);
router.route("/admin-topup").post(adminTopupInvestment);
router.route("/add-address").post(addWalletAddress);
router.route("/add-key").post(setPrivateKey);
router.route("/user-withdrawal-unblock").post(toggleWithdrawalAccess);
router.route("/user-block/:userId").post(toggleUserLogin);

// Banners Management (Multer setup inline hi rahega)
router.post("/upload-banner", bannerUpload.single("banner"), uploadBanner);
router.post("/delete-banner/:id", deleteBanner);
router.get("/get-address", getWalletAddress);
router.get("/get-key", getKey);
router.get("/get-userInfo/:username", getUserInfo);
router.post("/approve-withdrawals", approveAllWithdrawals);
router.post("/approve-withdrawal/:id", approveWithdrawal);
router.post("/reject-withdrawal/:id", rejectWithdrawal);
export default router;
