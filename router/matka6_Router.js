const express = require('express');
const router = express.Router();
const MatkaControll = require("../controller/satta6controller")
const multer = require('multer');
const config = require('../db');
const authMiddleware = require("../middleware/middleware/authMiddleware");
const configMiddleware = require("../middleware/middleware/configMiddleware")
const BaseControll = require("../controller/basecontroller")

// players detail matkahistory
router.post("/dashboardloadbazars",MatkaControll.dashboardloadbazars);

router.post("/get_result",authMiddleware.isLoggedIn,MatkaControll.get_result);
router.post("/create_result",authMiddleware.isLoggedIn,MatkaControll.create_result);
router.post("/update_result",authMiddleware.isLoggedIn,MatkaControll.update_result);
router.post("/delete_result",MatkaControll.delete_result);
router.post("/revenCalc",MatkaControll.revenCalc);
router.post("/today_result",authMiddleware.isLoggedIn,MatkaControll.today_result);
router.post("/all_result",authMiddleware.isLoggedIn,MatkaControll.allresult);

router.post("/adminGetLoadBazaars",MatkaControll.adminGetLoadBazaars);
router.post("/getBettingPlayers",authMiddleware.isLoggedIn,MatkaControll.getBettingPlayers);

router.post("/get_bets_from_bazarr",MatkaControll.get_bets_from_bazarr);
// router.post("/get_bets_from_resultannouncer",MatkaControll.get_bets_from_resultannouncer);


router.post("/checkingBazars",MatkaControll.checkingBazars);

// get_bets_from_resultannouncer
// resultannouncer

module.exports = router;