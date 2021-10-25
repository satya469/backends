const express = require('express');
const router = express.Router();
const PermissionCon = require("../controller/permissioncontroller");
const authMiddleware = require("../middleware/middleware/authMiddleware");

router.post("/role_menuload",authMiddleware.isLoggedIn,PermissionCon.roles_load)
router.post("/role_menuadd",authMiddleware.isLoggedIn,PermissionCon.roles_add)
router.post("/role_menudelete",authMiddleware.isLoggedIn,PermissionCon.roles_delete)
router.post("/role_menuupdate",authMiddleware.isLoggedIn,PermissionCon.roles_update)
router.post("/role_menuup",authMiddleware.isLoggedIn,PermissionCon.role_menuup)
router.post("/role_menudown",authMiddleware.isLoggedIn,PermissionCon.role_menudown)


module.exports = router;