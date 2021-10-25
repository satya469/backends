const express = require('express');
const router = express.Router();
const BetfairController = require("../controller/betfairController")
const authMiddleware = require("../middleware/middleware/authMiddleware");
const configMiddleware = require("../middleware/middleware/configMiddleware");
const multer = require('multer');
const config = require('../db');
const BaseControll = require("../controller/basecontroller")

router.post("/telgetSportsList", authMiddleware.isLoggedIn, BetfairController.telgetSportsList);

router.post("/getSportsList", authMiddleware.isLoggedIn, BetfairController.getSportsList);
router.post("/updateSportlist", authMiddleware.isLoggedIn, BetfairController.updateSportlist);
router.post("/orderupdateSportlist", authMiddleware.isLoggedIn, BetfairController.orderupdateSportlist);
router.post("/SportImgFileupload", authMiddleware.isLoggedIn, multer({ dest: config.BASEURL }).any(), BaseControll.imageupload, BetfairController.SportImgFileupload);
router.post("/SportImgageFileupload", authMiddleware.isLoggedIn, multer({ dest: config.BASEURL }).any(), BaseControll.imageupload, BetfairController.SportImgageFileupload);

router.post("/allowgetSportsList", authMiddleware.isLoggedIn, BetfairController.allowgetSportsList);
router.post("/getSerieslist", authMiddleware.isLoggedIn, BetfairController.getSerieslist);
router.post("/updateSerieslist", authMiddleware.isLoggedIn, BetfairController.updateSerieslist);
router.post("/getMatchesList", authMiddleware.isLoggedIn, BetfairController.getMatchesList);
router.post("/updateMatchlist", authMiddleware.isLoggedIn, BetfairController.updateMatchlist);
router.post("/updateInplaylist", authMiddleware.isLoggedIn, BetfairController.updateInplaylist);

router.post("/getMatketsList", authMiddleware.isLoggedIn, BetfairController.getMatketsList);
router.post("/updaetMatketsList", authMiddleware.isLoggedIn, BetfairController.updaetMatketsList);
router.post("/getFancyList", authMiddleware.isLoggedIn, BetfairController.getFancyList);
router.post("/updateFancyslist", authMiddleware.isLoggedIn, BetfairController.updateFancyslist);

router.post("/betsetminmaxvaluesave", authMiddleware.isLoggedIn, BetfairController.betsetminmaxvaluesave);
router.post("/betsetminmaxvalueget", authMiddleware.isLoggedIn, BetfairController.betsetminmaxvalueget);

router.post("/playergetsportlist", BetfairController.playergetsportlist);
router.post("/playergetmarketslist", BetfairController.playergetmarketslist);
router.post("/playergetopenbets",authMiddleware.isLoggedIn, BetfairController.playergetopenbets);

router.post("/playerplacebets",authMiddleware.isLoggedIn, BetfairController.playerplacebets);
router.post("/fancybetminmaxset",authMiddleware.isLoggedIn, BetfairController.fancybetminmaxset);
router.post("/fancybetminmaxget", authMiddleware.isLoggedIn,BetfairController.fancybetminmaxget);
//bookmarkersettingpart
router.post("/getactivematches", authMiddleware.isLoggedIn,BetfairController.getactivematches);
router.post("/updatematches", authMiddleware.isLoggedIn,BetfairController.updatematches);
router.post("/setminmaxupdatematches", authMiddleware.isLoggedIn,BetfairController.setminmaxupdatematches);
router.post("/setBettingStatusupdatematches", authMiddleware.isLoggedIn,BetfairController.setBettingStatusupdatematches);

// my markets part
router.post("/getmymarketsadmin", authMiddleware.isLoggedIn,BetfairController.getmymarketsadmin);
router.post("/getmymarketsplayer", authMiddleware.isLoggedIn,BetfairController.getmymarketsplayer);
router.post("/getMarketsById", authMiddleware.isLoggedIn,BetfairController.getMarketsById);
router.post("/betExchangefirstPage",BetfairController.betExchangefirstPage);

// dashboard part
router.post("/getdashboardmarketsadmin",authMiddleware.isLoggedIn, BetfairController.getdashboardmarketsadmin);
router.post("/getBetshistoryload",authMiddleware.isLoggedIn, BetfairController.getBetshistoryload);

// result part
router.post("/getMatchResultDatas", authMiddleware.isLoggedIn,BetfairController.getMatchResultDatas);
router.post("/getMatchDetailAdmin", authMiddleware.isLoggedIn,BetfairController.getMatchDetailAdmin);
router.post("/setResultOfMarket", BetfairController.setResultOfMarket);
router.post("/setRollbackResultOfMarket", authMiddleware.isLoggedIn,BetfairController.setRollbackResultOfMarket);

router.post("/admingetopenbets",authMiddleware.isLoggedIn, BetfairController.admingetopenbets);
router.post("/admingetfancybets",authMiddleware.isLoggedIn, BetfairController.admingetfancybets);
router.post("/admingetbookmakerbets",authMiddleware.isLoggedIn, BetfairController.admingetbookmakerbets);

router.post("/admingetExchangeBetHistory",authMiddleware.isLoggedIn, BetfairController.admingetExchangeBetHistory);

// profile detail
router.post("/adminbethistory_email_load",authMiddleware.isLoggedIn, BetfairController.adminbethistory_email_load);

router.post("/cancelExchangeBet",authMiddleware.isLoggedIn, BetfairController.cancelExchangeBet);
router.post("/betexchg_profitloss",authMiddleware.isLoggedIn, BetfairController.betexchg_profitloss);
router.post("/getPNLDetail",authMiddleware.isLoggedIn, BetfairController.getPNLDetail);
router.post("/getbetFromMarkets",authMiddleware.isLoggedIn, BetfairController.getbetFromMarkets);
router.post("/exchangeCancelBet",authMiddleware.isLoggedIn, BetfairController.exchangeCancelBet);
router.post("/getExchangeBetHistory",authMiddleware.isLoggedIn, BetfairController.getExchangeBetHistory);
router.post("/adminget_accountstatement",authMiddleware.isLoggedIn, BetfairController.adminget_accountstatement);

router.post("/adminbetexchg_profitloss",authMiddleware.isLoggedIn, BetfairController.adminbetexchg_profitloss);
router.post("/admingetPNLDetail",authMiddleware.isLoggedIn, BetfairController.admingetPNLDetail);
router.post("/admingetbetFromMarkets",authMiddleware.isLoggedIn, BetfairController.admingetbetFromMarkets);

router.post("/getBetradaId", BetfairController.getBetradaId);
router.post("/getIdFromPlayer", BetfairController.getIdFromPlayer);

module.exports = router;