const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/middleware/authMiddleware");
const FeedbackControl = require("../controller/feebackcontroller")

router.post("/load_menu",authMiddleware.isLoggedIn,FeedbackControl.load_menu);
router.post("/delete_menu",authMiddleware.isLoggedIn,FeedbackControl.delete_menu);
router.post("/update_menu",authMiddleware.isLoggedIn,FeedbackControl.update_menu);
router.post("/save_menu",authMiddleware.isLoggedIn,FeedbackControl.save_menu);

//player side bar
router.post("/getOptions",FeedbackControl.getOptions);
router.post("/feedSend",FeedbackControl.feedSend);

router.post("/feedbackhistoryLoad", FeedbackControl.feedbackhistoryLoad)

module.exports = router;
