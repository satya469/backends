const express = require('express');
const router = express.Router();
const ProfileControl = require('../controller/profilecontroller');
const multer = require('multer');
const config = require('../db');
const authMiddleware = require("../middleware/middleware/authMiddleware");
const BaseControll = require("../controller/basecontroller")
const url = require('url');

function urlparse(adr){
    var q = url.parse(adr, true);
    var qdata = q.query;
    return qdata;
}


router.post('/set_document',authMiddleware.isLoggedIn,multer({dest:config.BASEURL}).any(),ProfileControl.set_document);
router.post("/get_document",authMiddleware.isLoggedIn,ProfileControl.get_document);
router.post("/get_notification",authMiddleware.isLoggedIn,ProfileControl.get_notification);
router.post("/set_notification",authMiddleware.isLoggedIn,ProfileControl.set_notification);
router.get("/download",(req,res,next)=> {
    let indata = urlparse(req.url)
    res.download(config.APPURL + indata.id, indata.id)
})

router.post('/profilesave',authMiddleware.isLoggedIn,multer({dest:config.BASEURL}).any(),BaseControll.imageupload,ProfileControl.profilesave);
router.post('/avatarUpload',authMiddleware.isLoggedIn,multer({dest:config.BASEURL}).any(),BaseControll.imageupload,ProfileControl.avatarUpload);

module.exports = router;