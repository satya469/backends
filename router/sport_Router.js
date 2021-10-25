const express = require('express');
const router = express.Router();
const multer = require('multer');
const BaseControll = require("../controller/basecontroller")
const authMiddleware = require("../middleware/middleware/authMiddleware");
const SportControll = require("../controller/sportController.js");
const config = require('../db');

// Admin website
router.post("/getMinMax", authMiddleware.isLoggedIn, SportControll.getMinMax);
router.post("/setMinMax", authMiddleware.isLoggedIn, SportControll.setMinMax);

router.post("/getAdminSportsList", authMiddleware.isLoggedIn, SportControll.getAdminSportsList);
router.post("/getAdminSportData", authMiddleware.isLoggedIn, SportControll.getAdminSportData);
router.post("/setAdminMatchStatus", authMiddleware.isLoggedIn, SportControll.setAdminMatchStatus);
router.post("/setAdminFeatureData", authMiddleware.isLoggedIn, SportControll.setAdminFeatureData);
router.post("/getFeaturedDataAdmin", authMiddleware.isLoggedIn, SportControll.getFeaturedDataAdmin);
router.post("/removeFeaturedDataAdmin", authMiddleware.isLoggedIn, SportControll.removeFeaturedDataAdmin);
router.post("/updateProDataOfMatch", authMiddleware.isLoggedIn, SportControll.updateProDataOfMatch);

router.post("/getAllSportsType",  SportControll.getAllSportsType);
router.post("/uploadsportsImage", authMiddleware.isLoggedIn, multer({ dest: config.BASEURL }).any(), BaseControll.imageupload, SportControll.uploadsportsImage);
router.post("/sportsTypeUpdate", authMiddleware.isLoggedIn, SportControll.sportsTypeUpdate);

router.post("/getMyMarketData", authMiddleware.isLoggedIn, SportControll.getMyMarketData);
router.post("/selectedMatchAdmin", authMiddleware.isLoggedIn, SportControll.selectedMatchAdmin);
router.post("/getBetHistoryAdmin", authMiddleware.isLoggedIn, SportControll.getBetHistoryAdmin);

router.post("/getDashboardMarkets", authMiddleware.isLoggedIn, SportControll.getDashboardMarkets);
router.post("/getBetshistoryload", authMiddleware.isLoggedIn, SportControll.getBetshistoryload);
router.post("/cancelOneBet", authMiddleware.isLoggedIn, SportControll.cancelOneBet);

router.post("/getSDKStatus", SportControll.getSDKStatus);
router.post("/updateMtsStatus", SportControll.updateMtsStatus);

// Player website
router.post("/placeBetPlayer", authMiddleware.isLoggedIn, SportControll.placeBetPlayer);

router.post("/getFirstpageData", SportControll.getFirstpageData)
router.post("/getRecoveryEvent", SportControll.getRecoveryEvent);
router.post("/getFeaturedEvent", SportControll.getFeaturedEvent);

router.post("/getAllSportsEventsByEventStatus", SportControll.getAllSportsEventsByEventStatus);
router.post("/getSportsListPlayer", SportControll.getSportsListPlayer);
router.post("/getSportsMatchPlayer", SportControll.getSportsMatchPlayer)
router.post("/getOneMatchPlayer", SportControll.getOneMatchPlayer);

router.post("/getSportsBetHistory", authMiddleware.isLoggedIn, SportControll.getSportsBetHistory);

router.post("/getActiveBetCount", authMiddleware.isLoggedIn, SportControll.getActiveBetCount);
router.post("/cashout", authMiddleware.isLoggedIn, SportControll.cashOut);


// for MTS
router.post("/mtsStatus", SportControll.mtsStatus);
router.post("/cMtsStatus", SportControll.cMtsStatus);
router.post("/mtsConnectionStatus", SportControll.mtsConnectionStatus);
router.post("/ticketCancel", SportControll.ticketCancel);
router.post("/cashStatus", SportControll.cashStatus);

router.post("/deleteAllMatchs", SportControll.deleteAllMatchs)
router.post("/deleteAllBet", SportControll.deleteAllBet)

module.exports = router;