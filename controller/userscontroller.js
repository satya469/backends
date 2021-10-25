
const BASECON = require("./basecontroller");
const USERS = require("../models/users_model");
const CONFIG = require("../config/index.json");
const PROCONFIG = require("../servers/provider.json");

const CryptoJS = require("crypto-js");
const PlayersController = require("./playerscontroller");
const CMSController = require("./CMSController");
var mongoose = require('mongoose');
const adminUser = USERS.adminUser;
const themeModel = USERS.get_themeinfor;
const permission_model = USERS.permission_model;
const totalusermodel = USERS.totalusermodel;
const operators = USERS.operators;
const usersession = USERS.sessionmodel;
const usersessionmodel = USERS.usersessionmodel;
const gamesessionmodel = USERS.gamesessionmodel;
const { sportsBet } = require("../models/sports_model")
const { matka_betmodels } = require("../models/matka_model")
const GamePlay = USERS.GamePlay;
const sidebarmodel = USERS.sidebarmodel
const profilemenu = USERS.profilemenu;
const profilemenuByPlayermodel = USERS.profilemenuByPlayer;
const friendModel = USERS.friendModel;
const changepasswordhistory = USERS.changepasswordhistory;
const FIRSTPAGECON = require("../models/firstpage_model");
const firstpagesetting = FIRSTPAGECON.firstpagesetting;
const { PaymoroSubmitData, TransactionsHistory } = require("../models/paymentGateWayModel")
const Sendy = require('sendy-api');
const DB = require("../servers/home.json");
const KEYS = require("../config/configkeys")
const reportsControl = require("./reportcontroller")
const errorcode = {
    userblock: "Technical Error 1101"
}
const bethistory_model = require('../models/bethistory_model').BettingHistory_model;
const { CurrencyOptions } = require("../models/firstpage_model");
const { betfairbettinghistory } = require("../models/betfairmodel");
const betfairController = require("./betfairController")
const request = require("request");
const parse = require("xml-parser");

// run()
async function run() {
    // let skill = 500000, casino = 500000, livecasino = 500000
    // let d = await GamePlay.updateMany({ skill, casino, livecasino })
    let d = await GamePlay.updateMany({ wdlimit: 100000 })
    // console.log(d)
}

exports.list_to_tree = (list) => {
    var map = {}, node, roots = [], i;
    for (i = 0; i < list.length; i += 1) {
        map[list[i].id] = i; // initialize the map
        list[i].children = []; // initialize the children
    }

    for (i = 0; i < list.length; i += 1) {
        node = list[i];
        if (node.pid !== "0") {
            if (list[map[node.pid]]) {
                list[map[node.pid]].children.push(node);
                // return;
            } else {
                // return;
            }
            // if you have dangling branches check that map[node.parentId] exists
        } else {
            roots.push(node);
        }
    }
    return roots;
}


async function register_action(user, callback) {


    if (!user.email || !user.username || !user.password && !user.firstname && !user.lastname && !user.status && !user.created) {
        callback({ status: false, data: "please provide vallid data." });
        return;
    }

    let error = await BASECON.BfindOne(adminUser, { email: user.email });
    if (error) {
        callback({ status: false, data: "User Exists" })
        return;
    }

    if (user.mobilenumber && user.mobilenumber.length) {
        let error2 = await BASECON.BfindOne(adminUser, { mobilenumber: user.mobilenumber });
        if (error2) {
            callback({ status: false, data: "User Exists" })
            return;
        }
    }

    let error1 = await BASECON.BfindOne(adminUser, { username: user.username });
    if (error1) {
        callback({ status: false, data: "User Exists" })
        return;
    }

    var roles = await BASECON.BfindOne(permission_model, { id: user.permission });
    if (!roles) {
        callback({ status: false, data: "server error" })
        return;
    }

    let Newuser = new adminUser(user);
    let Newplayer = new GamePlay(user);
    Newplayer['id'] = Newuser._id;
    Newuser['playerid'] = mongoose.Types.ObjectId(Newplayer._id);
    Newuser['permissionid'] = mongoose.Types.ObjectId(roles._id);
    Newplayer['userid'] = mongoose.Types.ObjectId(Newuser._id);

    Newuser.password = Newuser.generateHash(Newuser.password);
    let betdelaytime = await BASECON.getbetdeplaytime()
    let exposure = await BASECON.getExposurelimit()
    let winning = await BASECON.getWinningLimit()
    
    Newplayer['betdelaytime'] = betdelaytime
    Newplayer['sattalimit'] = exposure.sattalimit
    Newplayer['exchangelimit'] = exposure.exchangelimit
    Newplayer['sportsbooklimit'] = exposure.sportsbooklimit

    Newplayer['casino'] = winning.casino
    Newplayer['livecasino'] = winning.livecasino
    Newplayer['skill'] = winning.skill

    let U_save = await BASECON.data_save(Newuser, adminUser)
    let P_save = await BASECON.data_save(Newplayer, GamePlay)

    if (U_save && P_save) {
        callback({ status: true, data: U_save });
    } else {
        callback({ status: false, data: "server error" });
    }
}


exports.telegramCreatePassword = async (req, res, next) => {
    let { password } = req.body;
    let user = req.user;
    if (password && password.length) {
        let item = await adminUser.findOne({ email: user.email });
        if (item) {
            item.password = item.generateHash(password);
            let up = await adminUser.findOneAndUpdate({ _id: item._id }, item);
            if (up) {
                return res.send({ status: true, data: "success" });
            } else {
                return res.send({ status: false, data: "server error" });
            }
        } else {
            return res.send({ status: false, data: "server error" });
        }
    } else {
        return res.send({ status: false, data: "server error" });
    }
}

exports.player_login = async (req, res, next) => {

    var password = req.body.password;
    var username = req.body.username;
    var error = "";
    var user = await BASECON.BfindOne(adminUser, { $or: [{ username: username }, { email: username }] });
    if (!user) {
        error = "we can't find with this email/username.";
        res.json({ status: false, error: error });
        return next();
    }



    if (!user.validPassword(password, user.password)) {
        error = "passwords do not match";
        res.json({ status: false, error: error });
        return next();
    }

    var homeConfig = req.homeConfig;

    var device = req.headers["user-device"] === "app" ? true : false;

    if (user.permission != homeConfig.USERS.player) {
        error = "You can't login with this email/username.";
        res.json({ status: false, error: error });
        return next();
    } else if (user.isdelete) {
        error = "This email/username was deleted.";
        res.json({ status: false, error: error });
        return next();
    } else if (user.status == homeConfig.USERS.status.pending) {
        error = "This email/username is pending.";
        res.json({ status: false, error: error });
        return next();
    } else if (user.status == homeConfig.USERS.status.block) {
        error = errorcode.userblock;
        res.json({ status: false, error: error });
        return next();
    }
    // else if ( homeConfig.mobileuserlogin && device != user.signup_device) {
    //     error = "You can't login with this email/username.";
    //     res.json({status : false,error : error});
    //     return next();
    // }
    else {

        let islogin = await usersession.findOne({ id: user._id });
        if (islogin) {

            await BASECON.BfindOneAndDelete(usersession, { id: user._id })
            await BASECON.BfindOneAndDelete(usersessionmodel, { id: user._id });
            await BASECON.BfindOneAndDelete(gamesessionmodel, { id: user._id });

            const io = req.app.get("socketio");
            let expires = {}
            expires[user.email] = true
            io.sockets.emit('destory', { data: expires });

            // error = "This account have already logged In";
            // res.json({status : false,error : error});
            // return next();
        }

        var compressed = this.accestoken(user);
        let ip = BASECON.get_ipaddress(req);
        await BASECON.data_save({ email: user.email, ip: ip, userid: user._id }, totalusermodel);

        
        let expo = await this.getExpoSureCountFromPlayer(user._id)
        let playerdata = user.playerid
        playerdata['exposure'] = expo
        return res.json({ status: true, data: compressed, user, playerdata });
    }
}


exports.LoginbyId = async (req, res, next) => {

    var token = req.body.token;
    var error = "";
    // try {
    let item = await PaymoroSubmitData.findOneAndDelete({ order_no: (token) });
    if (item) {
        var user = await BASECON.BfindOne(adminUser, { email: item.content });
        if (!user) {
            error = "we can't find with this email/username.";
            res.json({ status: false, error: error });
            return next();
        } else {
            var compressed = this.accestoken(user);
            let ip = BASECON.get_ipaddress(req);
            await BASECON.data_save({ email: user.email, ip: ip, userid: user._id }, totalusermodel);
            return res.json({ status: true, data: compressed, user });
        }
    } else {
        res.json({ status: false });
        return next();
    }
    // }catch(e) {
    //     res.json({status : false});
    //     return next();
    // }
}

exports.accestoken = (user) => {
    let hashstr = {
        _id: user._id,
        role: user.permission,
    }
    var authstr = BASECON.encrypt(JSON.stringify(hashstr));
    return authstr
}

exports.admin_login = async (req, res, next) => {

    var password = req.body.password;
    var username = req.body.username;
    var error = "";
    var user = await BASECON.BfindOne(adminUser, { $or: [{ username: username }, { email: username }] });
    if (!user) {
        error = "we can't find with this email/username.";
        res.json({ status: false, data: error });
        return next();
    }

    if (!user.validPassword(password, user.password)) {
        error = "passwords do not match";
        res.json({ status: false, data: error });
        return next();
    }
    var device = req.headers["user-device"] === "app" ? true : false;

    var homeConfig = req.homeConfig;

    if (user.permission == homeConfig.USERS.player) {
        error = "You can't login with this email/username.";
        res.json({ status: false, data: error });
        return next();
    } else if (user.isdelete) {
        error = "This email/username was deleted.";
        res.json({ status: false, data: error });
        return next();
    } else if (user.status == homeConfig.USERS.status.pending) {
        error = "This email/username is pending.";
        res.json({ status: false, data: error });
        return next();
    } else if (user.status == homeConfig.USERS.status.block) {
        error = errorcode.userblock;
        res.json({ status: false, data: error });
        return next();
    }
    // else if (homeConfig.mobileuserlogin && device != user.signup_device) {
    //     error = "You can't login with this email/username.";
    //     res.json({ status: false, data: error });
    //     return next();
    else {
        var compressed = this.accestoken(user);
        let ip = BASECON.get_ipaddress(req);
        await BASECON.data_save({ email: user.email, ip: ip, userid: user._id }, totalusermodel);
        res.json({ status: true, data: compressed });
        return next();
    }
}

exports.playerRegister = async (req, res, next) => {

    try {
        var homeConfig = req.homeConfig;
        let device = req.headers["user-device"];

        if (device == homeConfig.website || device == homeConfig.mobile) {

            let user = req.body.user;
            user['signup_device'] = device;
            user['permission'] = homeConfig.USERS.player;
            user['status'] = homeConfig.USERS.status.allow;
            user['isdelete'] = false;
            if (user['agentid']) {
                let agentUser = await BASECON.BfindOne(adminUser, { _id: user["agentid"] })
                user['created'] = agentUser.email
            } else {
                user['created'] = homeConfig.website == device ? homeConfig.USERS.webmail : homeConfig.USERS.appmail;
            }

            register_action(user, (rdata) => {
                if (rdata.status) {
                    const userId = rdata.data._id;
                    CMSController.profileList_register(userId)
                    signup_subscribe(rdata.data, (sdata) => {
                        res.json({ status: true, data: rdata.data });
                        return next();
                    });
                } else {
                    res.json(rdata);
                    return next();
                }
            });

        } else {
            res.send({ status: false, data: "error" });
            return next();
        }
    } catch (e) {
        res.send({ status: false, data: "error" });
        return next();
    }
}

exports.telegramregister = async (req, res, next) => {

    try {

        var homeConfig = req.homeConfig;
        let agentId = req.body.agentId;
        var friendId = req.body.friendId;
        let created = "";
        var agent = ""
        if (agentId && agentId.length) {
            let f = await adminUser.findOne({ fakeid: req.body.agentId });
            if (f && !BASECON.SuperadminChecking(f.permission)) {
                created = f.email;
            } else {
                created = homeConfig.USERS.telegrammail;
            }
        } else {
            created = homeConfig.USERS.telegrammail;
        }

        let botdevice = req.headers['bot-name'];
        let indata = req.body;
        let row = {
            username: (indata.username ? indata.username : indata.id),
            password: indata.id,
            email: indata.id,
            firstname: indata.firstName,
            lastname: indata.lastName ? indata.lastName : indata.id,
            status: homeConfig.USERS.status.allow,
            created: created,
            permission: homeConfig.USERS.player,
            signup_device: homeConfig.telegram,
            botdevice: botdevice
        }

        // return;

        register_action(row, async (rdata) => {
            if (rdata.status) {

                if (friendId && friendId.length) {
                    let friendUser = await adminUser.findOne({ email: friendId });
                    if (friendUser) {
                        let frow = {
                            FriendUserId: friendUser._id,
                            UserEmail: rdata.data.email,
                            UserId: rdata.data._id
                        }
                        let is = await friendModel.findOne({ FriendUserId: mongoose.Types.ObjectId(friendUser._id) });
                        if (!is) {
                            await BASECON.data_save(frow, friendModel)
                        }
                    }
                }
                res.json({ status: true, data: rdata.data });
                return next();
            } else {
                res.json(rdata);
                return next();
            }
        });

    } catch (e) {
        res.send({ status: false, data: "error" });
        return next();
    }
}

exports.get_adminthemestyle = async (req, res, next) => {
    var email = req.user.email;
    var rdata = await BASECON.BfindOne(themeModel, { email: email })
    if (!rdata) {
        res.json({ status: false, data: "fail" });
        return next();
    } else {
        res.json({ status: true, data: rdata });
        return next();
    }
}

exports.save_adminthmestyle = async (req, res, next) => {

    var email = req.user.email;
    var row = req.body.data;
    row['email'] = email;
    var outdata = await BASECON.BfindOneAndUpdate(themeModel, { email: row.email }, row);
    if (outdata) {
        res.json({
            status: true,
            data: outdata
        })
        return next();
    } else {
        res.json({
            status: false,
            data: "Fail"
        })
        return next();
    }
}

exports.get_user_detail = async (req, res, next) => {
    var user = req.user;

    if (user) {
        res.json({ status: true, data: user });
        return next();
    } else {
        return res.json({ session: true });
    }
}

exports.playerThemeGet = async (req, res, next) => {
    var email = "admin";
    var rdata = await BASECON.BfindOne(themeModel, { email: email })
    if (!rdata) {
        res.json({ status: false, data: "fail" });
        return next();
    } else {
        res.json({ status: true, data: rdata });
        return next();
    }
}


exports.playerThemeSave = async (req, res, next) => {
    var email = "admin";
    var row = req.body.data;
    row['email'] = email;
    var outdata = await BASECON.BfindOneAndUpdate(themeModel, { email: row.email }, row);
    if (outdata) {
        res.json({
            status: true,
            data: outdata
        })
        return next();
    } else {
        res.json({
            status: false,
            data: "Fail"
        })
        return next();
    }
}


exports.telegramGetUserinfor = async (req, res, next) => {
    let telegramid = req.body.id;
    var user = await BASECON.BfindOne(adminUser, { email: telegramid });
    if (user) {
        res.json({ status: true, data: user });
        return next();
    } else {
        res.send({ status: false, data: "error" });
        return next();
    }
}

exports.telegramUpdateLanguage = async (req, res, next) => {


    let telegramid = req.user.email;
    let code = (req.body.data);
    if (code && code.length > 0) {
        var user = await adminUser.findOneAndUpdate({ email: telegramid }, { language: code });
        if (user) {
            res.json({ status: true, data: user });
            return next();
        } else {
            res.send({ status: false, data: "error" });
            return next();
        }
    } else {
        res.send({ status: false, data: "error" });
        return next();
    }
}

exports.telegramUpdateAdress = async (req, res, next) => {

    let telegramid = req.body.id;
    let address = req.body.address;
    if (address && address.length > 0) {
        var user = await adminUser.findOneAndUpdate({ email: telegramid }, { address: address });
        if (user) {
            res.json({ status: true, data: user });
            return next();
        } else {
            res.send({ status: false, data: "error" });
            return next();
        }
    } else {
        res.send({ status: false, data: "error" });
        return next();
    }
}

exports.get_user_auth = async (req, res, next) => {
    let token = req.body.token;

    var authstr = JSON.parse(BASECON.decrypt(token));
    var user = await BASECON.BfindOne(adminUser, { _id: authstr._id });
    if (user) {
        res.json({ status: true, data: user });
        return next();
    } else {
        return res.json({ session: true });
    }
}

// exports.user_changepassword = async (req, res, next) => {
//     var user = req.body.data;
//     user.password = await BASECON.jwt_encode(user.password);
//     var rdata = await BASECON.BfindOneAndUpdate(adminUser, { email: user.email }, { password: user.password });
//     if (!rdata) {
//         res.json({
//             status: false,
//             data: "Email not found"
//         })
//         return next();
//     } else {
//         rdata.password = user.password;
//         res.json({
//             status: true,
//             data: await BASECON.jwt_encode(rdata)
//         })
//         return next();
//     }
// }

exports.admin_changepassword = async (req, res, next) => {
    var user = req.body.user;

    var item = await BASECON.BfindOne(adminUser, { email: req.user.email });
    var currentpassword = user.currentpassword;
    var password = user.password;

    if (!item.validPassword(currentpassword, item.password)) {
        error = "passwords do not match";
        res.json({ status: false, error: error });
        return next();
    }

    password = item.generateHash(password);
    var up = await BASECON.BfindOneAndUpdate(adminUser, { email: item.email }, { password: password });
    if (up) {
        let d = {
            userid: up._id,
            ipaddress: BASECON.get_ipaddress(req),
            useragent: req.headers['user-device']
        }
        await BASECON.data_save(d, changepasswordhistory)
        res.json({ status: true });
        return next();
    } else {
        res.json({ status: false, error: "server error" });
        return next();
    }
};





/////////--------------------------roles ----------------
exports.roles_load = async (req, res, next) => {
    var findhandle = "";
    findhandle = await BASECON.BSortfind(permission_model, {}, { order: 1 });
    if (!findhandle) {
        res.json({ status: false, data: "fail" })
        return next();
    } else {
        var data = BASECON.array_sort(findhandle, "order")
        res.json({ status: true, data: data })
        return next();
    }
}

exports.roles_menusave = async (req, res, next) => {
    var indata = req.body.data;
    indata['id'] = new Date().valueOf();
    var lastdata = await BASECON.BSortfind(permission_model, {}, { order: 1 });
    if (!lastdata) {
        res.json({ status: false, data: "fail" });
        return next();
    } else {
        if (lastdata.length) {
            indata['order'] = lastdata[lastdata.length - 1].order + 1;
        } else {
            indata['order'] = 1;
        }

        var savehandle = await BASECON.data_save(indata, permission_model);
        if (!savehandle) {
            res.json({ status: false, data: "fail" });
            return next();
        } else {
            var findhandle = await BASECON.BSortfind(permission_model, {}, { order: 1 });
            if (!findhandle) {
                res.json({ status: false, data: "fail" })
                return next();
            } else {
                var data = BASECON.array_sort(findhandle, "order")
                res.json({ status: true, data: data })
                return next();
            }
        }
    }
}

exports.roles_menuupdate = async (req, res, next) => {
    var indata = req.body.data;
    for (var i = 0; i < indata.length; i++) {
        var updatehandle = await BASECON.BfindOneAndUpdate(permission_model, { _id: indata[i]._id }, indata[i]);
        if (!updatehandle) {
            res.json({ status: false, data: "fail" });
            return next();
        }
    }
    var findhandle = await BASECON.BSortfind(permission_model, {}, { order: 1 });
    if (!findhandle) {
        res.json({ status: false, data: "fail" })
        return next();
    } else {
        var data = BASECON.array_sort(findhandle, "order")
        res.json({ status: true, data: data })
        return next();
    }
}

exports.roles_menudelete = async (req, res, next) => {
    var indata = req.body.data;
    var outdata = await BASECON.BfindOneAndDelete(permission_model, { _id: indata._id })
    if (!outdata) {
        res.json({ status: false, data: "fail" })
        return next();
    } else {
        var findhandle = "";
        findhandle = await BASECON.BSortfind(permission_model, {}, { order: 1 });
        if (!findhandle) {
            res.json({ status: false, data: "fail" })
            return next();
        } else {
            var data = BASECON.array_sort(findhandle, "order")
            res.json({ status: true, data: data })
            return next();
        }
    }
}
///////---------------users cms
exports.get_users_items = async (role) => {                 ///////////////-----------------get user items
    var data = [];
    async function recurse(email) {
        var rows = await BASECON.Bfind(adminUser, { isdelete: false, created: email });
        // data = rows;
        // return;
        if (rows.length == 0) {
            return;
        } else {
            for (var i = 0; i < rows.length; i++) {
                data.push(rows[i]);
                await recurse(rows[i].email);
            }
        }
    }
    if (BASECON.SuperadminChecking(role.permission)) {
        data = await BASECON.Bfind(adminUser, { isdelete: false });
    } else {
        await recurse(role.email);
    }

    var news = [];

    for (var i in data) {
        let row = Object.assign({}, data[i]._doc);
        row['playerid'] = BASECON.getPlayerBalanceCal(row['playerid'])
        news.push(row);
    }

    news.sort(function (news, b) {
        return new Date(b.date) - new Date(news.date)
    })

    return news;
}

exports.get_players_items = async (role) => {       
    
    // let data = []
    // if (BASECON.SuperadminChecking(role.permission)) {
    //     data = await BASECON.Bfind(adminUser, { isdelete: false });
    // } else {
    //     let users = await this.get_users_items_users(role)
    //     for (let i in users) {
    //         var rows = await BASECON.Bfind(adminUser, { isdelete: false, created: users[i].email });
    //         data = [...data, ...rows]
    //     }
    // }
    /////////////-----------------get user items
    var data = [];
    async function recurse(email) {
        var rows = await BASECON.Bfind(adminUser, { isdelete: false, created: email });

        if (rows.length == 0) {
            return;
        } else {
            for (var i = 0; i < rows.length; i++) {
                data.push(rows[i]);
                await recurse(rows[i].email);
            }
        }
    }
    if (BASECON.SuperadminChecking(role.permission)) {
        data = await BASECON.Bfind(adminUser, { isdelete: false });
    } else {
        await recurse(role.email);
    }

    var news = [];

    for (var i in data) {
        if (data[i].permission === CONFIG.USERS.player) {
            let row = Object.assign({}, data[i]._doc);
            row['playerid'] = BASECON.getPlayerBalanceCal(row['playerid'])
            news.push(row);
        }
    }

    news.sort(function (news, b) {
        return new Date(b.date) - new Date(news.date)
    })
    return news;
}


exports.get_users_items_users = async (role) => {                 ///////////////-----------------get user items
    var data = [];
    async function recurse(email) {
        var rows = await BASECON.Bfind(adminUser, { isdelete: false, created: email, permission: { $ne: CONFIG.USERS.player } });
        if (rows.length == 0) {
            return;
        } else {
            for (var i = 0; i < rows.length; i++) {
                data.push(rows[i]);
                await recurse(rows[i].email);
            }
        }
    }
    if (BASECON.SuperadminChecking(role.permission)) {
        data = await BASECON.Bfind(adminUser, { isdelete: false, permission: { $ne: CONFIG.USERS.player } });
    } else {
        await recurse(role.email);
    }


    return data;
}

exports.get_users_items_block = async (role) => {                 ///////////////-----------------get user items
    var data = [];
    async function recurse(email) {
        var rows = await BASECON.Bfind(adminUser, { status: CONFIG.USERS.status.block });
        // data = rows;
        // return;
        if (rows.length == 0) {
            return;
        } else {
            for (var i = 0; i < rows.length; i++) {
                data.push(rows[i]);
                await recurse(rows[i].email);
            }
        }
    }
    if (BASECON.SuperadminChecking(role.permission)) {
        data = await BASECON.Bfind(adminUser, { status: CONFIG.USERS.status.block });
    } else {
        await recurse(role.email);
    }

    return data;
}

exports.get_users_for_permission = async (role, start, end) => {                 ///////////////-----------------get user items
    var data = [];
    async function recurse(email) {
        var rows = await BASECON.Bfind(adminUser, { $and: [{ "date": { $gte: start } }, { "date": { $lte: end } }, { "permission": CONFIG.USERS.player }, { isdelete: false }, { created: email }] });
        // data = rows;
        // return;
        if (rows.length == 0) {
            return;
        } else {
            for (var i = 0; i < rows.length; i++) {
                data.push(rows[i]);
                await recurse(rows[i].email);
            }
        }
    }

    if (BASECON.SuperadminChecking(role.permission)) {
        data = await BASECON.Bfind(adminUser, { $and: [{ "date": { $gte: start } }, { "date": { $lte: end } }, { isdelete: false }, { "permission": CONFIG.USERS.player }] });
    } else {
        await recurse(role.email);
    }

    return data;
}



exports.get_users_load_block = async (req, res, next) => {
    var role = BASECON.getUserItem(req)
    var userslist = await this.get_users_items_block(role);
    var data = await this.roles_get_fact(role);
    if (!userslist) {
        res.json({
            status: false,
            data: 'failture'
        });
        return next();
    } else {
        res.json({
            status: true,
            data: userslist, roledata: data
        });
        return next();
    }
}

exports.adminRegisterByuser = async (req, res, next) => {


    try {
        let adminmail = req.user;
        delete req.body.user._id;
        let homeConfig = req.homeConfig
        let user = req.body.user;
        user['isdelete'] = false;

        if (user.permission != homeConfig.USERS.supermaster && BASECON.SuperadminChecking(adminmail.permission) && BASECON.SuperadminChecking(user.permission)) {
            if (user.signup_device == homeConfig.website) {
                user['created'] = homeConfig.USERS.webmail;
            } else {
                user['created'] = homeConfig.USERS.appmail;
            }
        } else {
            user['created'] = adminmail.email;
        }

        register_action(user, async (rdata) => {
            if (rdata.status) {
                this.get_users_load(req, res, next);
            } else {
                res.json(rdata);
                return next();
            }
        });

    } catch (e) {
        res.send({ status: false, data: "error" });
        return next();
    }
}

exports.get_rolesfrom_per = async (req, res, next) => {
    var role = await BASECON.getUserItem(req)
    var data = await this.roles_get_fact(role);
    if (data) {
        res.json({ status: true, data: data });
        return next();
    } else {
        res.json({ status: false, data: "false" });
        return next();
    }
}

exports.roles_get_fact = async (role) => {
    var data = [];
    async function recurse(id) {
        var rows = await BASECON.Bfind(permission_model, { pid: id });
        // data = rows;
        // return;
        if (rows.length == 0) {
            return;
        } else {
            for (var i = 0; i < rows.length; i++) {
                data.push(rows[i]);
                await recurse(rows[i].id);
            }
        }
    }
    if (BASECON.SuperadminChecking(role.permission)) {
        data = await BASECON.Bfind(permission_model,);
    } else {
        await recurse(role.permission);
    }
    return data;
}
/////////////////-------------role manger- cms


exports.adminsidebar_load = async (req, res, next) => {
    var role = req.user.permissionid.id;
    var condition = {};
    condition["roles." + role] = true;
    condition['status'] = true;
    var rdata = await BASECON.BSortfind(sidebarmodel, condition, { order: 1 });
    if (rdata) {
        var newrow = this.list_to_tree(rdata)
        res.json({ status: true, data: newrow, array: rdata });
        return next();
    } else {
        res.json({ status: false, data: [] });
        return next();
    }
}

exports.userdetail_save = async (req, res, next) => {
    var user = req.body.user;

    let row = {
        firstname: user.firstname,
        lastname: user.lastname,
        mobilenumber: user.mobilenumber
    }
    var rdata = await BASECON.BfindOneAndUpdate(adminUser, { email: user.email }, row);
    if (rdata) {
        res.json({
            status: true,
            data: rdata
        })
    } else {
        res.json({
            status: false,
            data: "Email not found"
        })
        return next();
    }
}

exports.adminuserupdateByuser = async (req, res, next) => {


    var indata = req.body.newinfor;
    if (!indata.email || !indata.username || !indata.password && !indata.firstname && !indata.lastname && !indata.status) {
        res.send({ status: false, data: "please provide valid data." });
        return next();
    }

    var row = Object.assign({}, { firstname: indata.firstname }, { lastname: indata.lastname });
    delete indata.created;
    delete indata.email;
    delete indata.username;

    var rdata1 = await GamePlay.findOneAndUpdate({ id: indata._id }, row);
    let permissionid = await permission_model.findOne({ id: indata.permission })
    if (permissionid) {
        indata['permissionid'] = permissionid._id
        var rdata = await adminUser.findOneAndUpdate({ _id: indata._id }, indata);
        if (rdata1 && rdata) {
            this.get_users_load(req, res, next);
            return;
        } else {
            res.json({ status: false, data: 'failture' });
            return next();
        }
    } else {
        res.json({ status: false, data: 'failture' });
        return next();
    }
}

exports.adminresetpassword = async (req, res, next) => {


    var user = req.body.user;
    if (!user.password || !user.email) {
        res.json({ status: false, data: 'failture' });
        return next();
    }
    var item = await BASECON.BfindOne(adminUser, { email: user.email });
    var password = item.generateHash(user.password);
    var rdata = await BASECON.BfindOneAndUpdate(adminUser, { email: user.email }, { password: password });
    if (!rdata) {


        res.json({ status: false, data: 'failture' });
        return next();
    } else {
        let d = {
            userid: rdata._id,
            ipaddress: BASECON.get_ipaddress(req),
            useragent: req.headers['user-device']
        }
        await BASECON.data_save(d, changepasswordhistory)
        res.json({ status: true });
        return next();
    }
}

exports.adminmultiusersblock = async (req, res, next) => {

    var users = req.body.users;
    for (var i in users) {
        await BASECON.BfindOneAndUpdate(adminUser, { _id: users[i]._id }, { status: CONFIG.USERS.status.block })
    }
    this.get_users_load(req, res, next);
}

exports.adminmultiusersdelete = async (req, res, next) => {

    var users = req.body.users;
    for (var i in users) {
        await BASECON.BfindOneAndUpdate(adminUser, { _id: users[i]._id }, { isdelete: true })
    }
    this.get_users_load(req, res, next);
}

exports.PlayerRegisterByadmin = async (req, res, next) => {

    try {
        let adminmail = req.user;
        delete req.body.user._id;
        let homeConfig = req.homeConfig
        let user = req.body.user;
        user['permission'] = homeConfig.USERS.player;
        user['status'] = homeConfig.USERS.status.allow;
        user['isdelete'] = false;
        if (BASECON.SuperadminChecking(adminmail.permission)) {
            if (user.signup_device == homeConfig.website) {
                user['created'] = homeConfig.USERS.webmail;
            } else {
                user['created'] = homeConfig.USERS.appmail;
            }
        } else {
            user['created'] = adminmail.email;
        }

        register_action(user, async (rdata) => {
            if (rdata.status) {
                const userId = rdata.data._id;
                let d = await CMSController.profileList_registetByAdmin(userId)
                PlayersController.players_loadLimit(req, res, next);
            } else {
                res.json(rdata);
                return next();
            }
        });

    } catch (e) {
        res.send({ status: false, data: "error" });
        return next();
    }
}


exports.users_depositaction = async (req, res, next) => {
    let ressult = await PlayersController.deposit_func(req);
    if (ressult.status) {
        this.get_users_load(req, res, next);
        return
    } else {
        res.json({ status: false, data: ressult.data });
        return next();
    }
}

exports.users_withdrawlaction = async (req, res, next) => {
    let ressult = await PlayersController.withdrawlfunc(req);
    if (ressult.status) {
        this.get_users_load(req, res, next);
        return
    } else {
        res.json({ status: false, data: ressult.data });
        return next();
    }
}

exports.decrypt_auth = (req, res, next) => {
    try {
        let data = req.body.auth;
        let decypstr = JSON.parse(BASECON.decrypt(data));
        res.json({ status: true, data: decypstr });
        return next();
    } catch (e) {
        res.status(404, { msg: "BAD request" })
        return next();
    }
}

exports.getip = (req, res, next) => {

    var forwarded = req.headers['x-forwarded-for'];
    var ips = forwarded ? forwarded.split(/, /)[0] : req.connection.remoteAddress;
    var ip = ips && ips.length > 0 && ips.indexOf(",") ? ips.split(",")[0] : null;
    res.json({ ip: ip });
}



//////////////---------------email verify ------------------------////////////////////////////
async function signup_subscribe(user, callback) {

    var domain = DB.homedomain;
    var data = {
        email: user.email,
        init: new Date().valueOf(),
    }

    let sconfig = await firstpagesetting.findOne({ type: KEYS.SendyConfig });
    if (sconfig) {
        const sendy = new Sendy(sconfig.content.apiurl, sconfig.content.apikey);
        var verifyCode = CryptoJS.AES.encrypt(JSON.stringify(data), CONFIG.USERS.secret_key).toString();
        let row = {
            order_no: data.init,
            content: verifyCode,
            date: new Date(new Date().valueOf() + 24 * 60 * 60 * 1000)

        }
        let sh = await BASECON.data_save(row, PaymoroSubmitData);
        if (sh) {
            var verifyString = '<a href="' + domain + "/emailverify?code=" + sh._id + '"  target="_blank"><span>Confirm</span> </a>';
            sendy.subscribe({ email: user.email, list_id: sconfig.content.list_id, api_key: sconfig.content.apikey, name: user.username, verify: verifyString }, function (err, result) {
                if (err) {
                    callback(false, err);
                } else {
                    callback(true, result);
                }
            });
        } else {
            callback(false);
        }

    } else {
        callback(false);
    }

};

async function forgotPassword_sendmail(user, callback) {

    var domain = DB.homedomain;
    var data = {
        email: user.email,
        init: new Date().valueOf(),
    }

    let sconfig = await firstpagesetting.findOne({ type: KEYS.SendyConfig });
    if (sconfig) {
        const sendy = new Sendy(sconfig.content.apiurl, sconfig.content.apikey);
        var verifyCode = CryptoJS.AES.encrypt(JSON.stringify(data), CONFIG.USERS.secret_key).toString();
        let row = {
            order_no: data.init,
            content: verifyCode,
            email: data.email,
            date: new Date(new Date().valueOf() + 24 * 60 * 60 * 1000)
        }
        let sh = await BASECON.data_save(row, PaymoroSubmitData);
        if (sh) {
            var verifyString = '<a href="' + domain + "/forgotpasswordverify?code=" + sh._id + '"  target="_blank"><span>Confirm</span> </a>';
            sendy.subscribe({ email: user.email, list_id: sconfig.content.list_id1, api_key: sconfig.content.apikey, name: user.username, forgotemailverify: verifyString, link: domain + "/forgotpasswordverify?code=" + sh._id }, function (err, result) {
                if (err) {
                    callback(false, err);
                } else {
                    callback(true, result);
                }
            });
        } else {
            callback(false);
        }
    } else {
        callback(false);
    }
};

function unsubscribe(user, listid, callback) {

    var params = {
        email: user.email,
        list_id: listid
    }

    sendy.unsubscribe(params, function (err, result) {

        if (err) {
            callback(false, err)
        } else {
            callback(true, result)
        }
    })
}

exports.emailverify_receive_action = async (req, res, next) => {
    var data = req.body.data;
    var data = req.body.data;
    let item = await PaymoroSubmitData.findOneAndDelete({ _id: mongoose.Types.ObjectId(data) });
    if (item) {
        try {
            var bytes = CryptoJS.AES.decrypt(item.content, CONFIG.USERS.secret_key);
            var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
            var fuserdata = await BASECON.BfindOne(adminUser, { email: decryptedData.email });
            if (!fuserdata) {
                res.json({ status: false, data: "server error" });
            } else {
                var rdata = await adminUser.findOneAndUpdate({ email: decryptedData.email }, { emailverify: true });
                if (rdata) {
                    res.json({ status: true, data: "success" })
                } else {
                    res.json({ status: false, data: "server error" })
                    return next()
                }
            }
        } catch (e) {
            res.json({ status: false, data: "server error" })
            return next()
        }
    } else {
        res.json({ status: false, data: "server error" })
        return next()
    }

}

exports.getSessionsports = async (req, res, next) => {
    let id = req.body.id;
    // try{
    var user = await BASECON.BfindOne(adminUser, { _id: mongoose.Types.ObjectId(id) });
    if (user) {
        let row = {
            order_no: BASECON.md5convert(new Date().valueOf().toString()),
            content: user.email,
            date: new Date(new Date().valueOf() + 24 * 60 * 60 * 1000)
        }

        let sh = await BASECON.data_save(row, PaymoroSubmitData);
        if (sh) {
            let url = DB.homedomain + "/sports?token=" + row.order_no;
            res.json({ status: true, data: url });
            return next();
        } else {
            res.json({ status: false, data: "fail" });
            return next();
        }
    } else {
        res.json({ status: false, data: "fail" });
        return next();
    }
    // }catch(e){
    //     res.json({status : false,data : "fail"});
    //     return next();
    // }
}

exports.getSessionSatta = async (req, res, next) => {
    let id = req.body.id;
    // try{
    var user = await BASECON.BfindOne(adminUser, { _id: mongoose.Types.ObjectId(id) });
    if (user) {
        let row = {
            order_no: BASECON.md5convert(new Date().valueOf().toString()),
            content: user.email,
            date: new Date(new Date().valueOf() + 24 * 60 * 60 * 1000)
        }

        let sh = await BASECON.data_save(row, PaymoroSubmitData);
        if (sh) {
            let url = DB.homedomain + "/Satta/pages?token=" + row.order_no;
            res.json({ status: true, data: url });
            return next();
        } else {
            res.json({ status: false, data: "fail" });
            return next();
        }
    } else {
        res.json({ status: false, data: "fail" });
        return next();
    }
    // }catch(e){
    //     res.json({status : false,data : "fail"});
    //     return next();
    // }
}

exports.forgotpassword_receive_action = async (req, res, next) => {

    var data = req.body.data;
    let item = await PaymoroSubmitData.findOneAndDelete({ _id: mongoose.Types.ObjectId(data) });
    if (item) {
        try {
            var bytes = CryptoJS.AES.decrypt(item.content, CONFIG.USERS.secret_key);
            var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
            var fuserdata = await BASECON.BfindOne(adminUser, { email: decryptedData.email });
            if (fuserdata) {
                res.json({ status: true, data: fuserdata.email });
                return next();
            } else {
                res.json({ status: false, data: "fail" });
                return next();
            }
        } catch (e) {
            res.json({ status: false, data: "server error" })
            return next()
        }
    } else {
        res.json({ status: false, data: "server error" })
        return next()
    }
}

exports.forgotpassword_send_action = async (req, res, next) => {

    var data = req.body.email;
    var fdata = await BASECON.BfindOne(adminUser, { email: data });
    if (fdata) {

        let isexit = await PaymoroSubmitData.findOne({ email: data });
        if (isexit) {
            res.json({ status: false, data: "You have already sent" });
            return next();
        } else {
            forgotPassword_sendmail(fdata, (rdata) => {
                if (rdata) {
                    res.json({ status: true });
                    return next();
                } else {
                    res.json({ status: false, data: "We are sorry. it bounced email address." });
                    return next();
                }
            })
        }
    } else {
        res.json({ status: false, data: "we are sorry. we can't find this email" });
        return next();
    }
}

exports.forgotpassword_set_action = async (req, res, next) => {
    var data = req.body.data;
    var fdata = await BASECON.BfindOne(adminUser, { email: data.email });
    if (fdata) {

        fdata.password = fdata.generateHash(data.password);
        let up = await adminUser.findOneAndUpdate({ email: fdata.email }, fdata);
        if (up) {
            res.json({ status: true, data: up });
            return next()
        } else {
            res.json({ status: false, data: "server error" })
            return next();
        }
    } else {
        res.json({ status: false, data: "server error" })
        return next();
    }
}

exports.resend_email_action = async (req, res, next) => {

    var email = req.body.email;
    var userdata = await BASECON.BfindOne(adminUser, { email: email });
    if (userdata) {
        // const userdata = {
        //     email : "burkodegor@gmail.com",
        //     username : "igamez zhen"
        // }
        signup_subscribe(userdata, (rdata, error) => {
            if (rdata) {
                res.send({ status: true });
            } else {
                res.send({ status: false });
            }
        })

    } else {
        res.json({ status: false, data: "server error" })
        return next();
    }

}

exports.telegramGetSupportChat = async (req, res, next) => {


    if (req.user && req.user.playerid && parseInt(req.user.playerid.balance) > 0) {

        let d1 = await firstpagesetting.findOne({ type: "LiveChatSetting" });
        if (d1) {
            if (d1.content.status) {
                res.send({ status: true, data: d1.content.directsrc });
                return next();
            } else {
                res.send({ status: false, data: "" });
                return next();
            }
        } else {
            res.send({ status: false, data: "" });
            return next();
        }
    } else {
        res.send({ status: false, data: "" });
        return next();
    }
}


exports.getsattaOperators = async (req, res, next) => {
    let params = req.body.params;
    if (params) {
        let array = [];
        let pages = {};

        let totalcount = await operators.countDocuments();
        pages = reportsControl.setpage(params, totalcount);
        if (totalcount > 0) {
            array = await operators.find().skip(pages.skip).limit(pages.params.perPage);
        }

        pages["skip2"] = (pages.skip) + array.length;
        res.send({
            status: true, data: array,
            pageset: pages,
        });
        return next();

    } else {
        res.send({ status: false, data: "error" });
        return next();
    }
}

exports.savesattaOperators = async (req, res, next) => {

    let row = req.body.row;
    let sh = await BASECON.data_save(row, operators);
    if (sh) {
        this.getsattaOperators(req, res, next);
    } else {
        res.send({ status: false, data: "error" });
        return next();
    }
}

exports.updatesattaOperators = async (req, res, next) => {
    let row = req.body.row;
    let up = await BASECON.BfindOneAndUpdate(operators, { _id: row._id }, row);
    if (up) {
        this.getsattaOperators(req, res, next);
    } else {
        res.send({ status: false, data: "error" });
        return next();
    }
}

exports.deletesattaOperators = async (req, res, next) => {
    let data = req.body.row;
    if (data) {
        let Dhan = await BASECON.BfindOneAndDelete(operators, { _id: data._id });
        if (Dhan) {
            this.getsattaOperators(req, res, next);
        } else {
            res.send({ status: false, data: "error" });
            return next();
        }

    } else {
        res.send({ status: false, data: "error" });
        return next();
    }
}


exports.get_users_load = async (req, res, next) => {
    const role = BASECON.getUserItem(req)
    const userslist = await this.get_users_items_users(role);
    const data = await this.roles_get_fact(role);
    if (!userslist) {
        res.json({
            status: false,
            data: 'failture'
        });
        return next();
    } else {
        let rows = []
        let totals = {
            creditreference: 0,
            balance: 0,
            profitloss: 0,
            exposure: 0,
            playersbalance: 0
        }
        for (let i in userslist) {
            let row = Object.assign({}, userslist[i]._doc)
            row['exposurelimit'] = 0

            if (!BASECON.SuperigamezChecking(role.permission) && BASECON.SuperigamezChecking(userslist[i].permission)) {
                continue;
            }
            if (!BASECON.SuperadminChecking(userslist[i].permission)) {
                let players = await this.get_players_items(row)
                let exposure = await this.getExpoSureCount(players)
                let playersbalance = this.getPlayersBalance(players)
                // let profit  =await this.getProfitLoss(players)
                row['exposure'] = exposure
                // row['profitloss'] = profit
                row['playersbalance'] = playersbalance
                row['creditreference'] = await this.getcreditreference(row)

                totals.creditreference += row.creditreference
                totals.exposure += row.exposure
                totals.balance += row.playerid.balance
                // totals.profitloss += row.profitloss
                totals.playersbalance += row.playersbalance
                rows.push(row)
            } else {
                row['exposure'] = 0
                row['playersbalance'] = 0
                row['creditreference'] = 0
                row['profitloss'] = 0
                rows.push(row)
            }
        }
        res.json({
            status: true,
            data: rows, roledata: data, totals
        });
        return next();
    }
}

exports.getPlayersBalance = (players) => {
    let balance = 0
    for (let i in players) {
        balance += players[i].playerid.balance
    }
    return balance
}

exports.getcreditreference = async (item) => {
    let d = await TransactionsHistory.aggregate([
        {
            $match: {
                $and: [{
                    'status': "Approve",
                    'wallettype': "DEPOSIT",
                    'type': "admin",
                    "userid": mongoose.Types.ObjectId(item._id)
                }]
            }
        },
        {
            $group: {
                "_id": null,
                AMOUNT: { $sum: '$amount' },
            }
        },
    ])
    if (d.length) {
        return d[0].AMOUNT
    } else {
        return 0
    }
}

exports.getExpoSureCount = async (players) => {

    let sattaorquery = []
    let sportorquery = []
    for (let i in players) {
        sattaorquery.push(players[i]._id)
    }

    if (players.length) {
        let sportsbetscount = await sportsBet.countDocuments({ USERID: { $in: sportorquery }, "betting.handleState": false })
        let sattabetscount = await matka_betmodels.countDocuments({ userid: { $in: sattaorquery }, betacept: false })
        return sportsbetscount + sattabetscount
    } else {
        return 0
    }
}


exports.getExpoSureCountFromPlayer = async (userid) => {
    let sportsExposure = await this.getSportsExposure(userid)
    return sportsExposure
}

exports.getProfitLoss = async (players) => {
    var totalwallet = {
        BET: 0,
        WIN: 0,
        CANCELED_BET: 0,
        betindex: 0
    };

    var orquery = [];
    for (var i in players) {
        orquery.push(mongoose.Types.ObjectId(players[i]._id))
    }

    if (orquery.length > 0) {
        var totals = await bethistory_model.aggregate(
            [
                {
                    $match:
                    {
                        $and:
                            [
                                {
                                    AMOUNT: { $ne: 0 },
                                    userid: {
                                        $in: orquery
                                    }
                                },
                            ]
                    }
                },
                {
                    $group:
                    {
                        _id: "$TYPE",
                        AMOUNT: { $sum: '$AMOUNT' },
                        COUNT: { $sum: 1 },
                    }
                }
            ]
        )

        for (var k in totals) {
            totalwallet[totals[k]["_id"]] = totals[k].AMOUNT;
            if (totals[k]["_id"] == "BET") {
                totalwallet["betindex"] = totals[k].COUNT
            }
        }
    }

    var Profit = parseInt(totalwallet.BET - totalwallet.CANCELED_BET - totalwallet.WIN);
    return Profit

}

exports.getsattaExposure = async (id) => {
    let exposure = 0;
    let d = await matka_betmodels.aggregate([
        {
            $match: {
                $and: [
                    { userid: id, "betacept": false }
                ]
            }
        },
        {
            $group: {
                "_id": null,
                "amount": { "$sum": "$amount" }
            }
        }
    ])
    if (d && d.length) {
        exposure += d[0].amount
    }

    return exposure
}

exports.getSportsExposure = async (id) => {
    let exposure = 0;
    let d = await sportsBet.aggregate([
        {
            $match: {
                $and: [
                    { USERID: id, "betting.handleState": false }
                ]
            }
        },
        {
            $group: {
                "_id": null,
                "amount": { "$sum": "$AMOUNT" }
            }
        }
    ])
    if (d && d.length) {
        exposure = d[0].amount * -1
    }

    d = await matka_betmodels.aggregate([
        {
            $match: {
                $and: [
                    { userid: id, "betacept": false }
                ]
            }
        },
        {
            $group: {
                "_id": null,
                "amount": { "$sum": "$amount" }
            }
        }
    ])
    if (d && d.length) {
        exposure -= d[0].amount
    }

    d = await betfairController.getTotalExchangeExposure(id);

    // d = await betfairbettinghistory.aggregate([
    //     {
    //         $match: {
    //             $and: [
    //                 { userid: id,  }
    //             ]
    //         }
    //     },
    //     {
    //         $group: {
    //             "_id": null,
    //             "amount": { "$sum": "$stake" }
    //         }
    //     }
    // ])
    // if (d && d.length) {
    // exposure += d[0].amount
    exposure += d
    // }

    return exposure
}

exports.GetUserProfileLoad = async (req, res, next) => {
    const email = req.user.email;
    const themedata = await BASECON.BfindOne(themeModel, { email: email })

    var roles = await profilemenu.find({ status: true }, "children type pid title id navLink icon")
    var child = await BASECON.Bfind(profilemenuByPlayermodel, { userId: req.user._id });
    var sdata = []
    if(child.length) {
        var seted = child[0].profileList;
        for(let i=0; i<roles.length; i++) {
            if (seted[roles[i]['_id']] !== false) {
                sdata.push(roles[i]);
            }
        }
    } else {
        sdata = roles;
    }
    const sidebar = this.list_to_tree(sdata)
    let sportsExposure = await this.getSportsExposure(req.user._id)
    // let sattabetscount = await matka_betmodels.countDocuments({ userid: mongoose.Types.ObjectId(req.user._id), betacept: false })
    const exposure = sportsExposure
    const currency = await CurrencyOptions.findOne({ active: true });

    res.json({ status: true, themedata, sidebar, exposure, currency });
    return next();
}

exports.cgetlist = async (req, res, next) => {

    const role = await adminUser.findOne({ _id: req.body.params.id })
    if (role) {
        const userslist = await this.get_players_items(role);
        const data = await this.roles_get_fact(role);
        if (!userslist) {
            res.json({
                status: false,
                data: 'failture'
            });
            return next();
        } else {
            let rows = []
            let totals = {
                creditreference: 0,
                balance: 0,
                profitloss: 0,
                exposure: 0,
                playersbalance: 0
            }
            for (let i in userslist) {
                let row = userslist[i]
                row['exposurelimit'] = 0
                if (!BASECON.SuperadminChecking(userslist[i].permission)) {
                    let players = await this.get_players_items(row)
                    let exposure = await this.getExpoSureCount(players)
                    let playersbalance = this.getPlayersBalance(players)
                    // let profit  =await this.getProfitLoss(players)
                    row['exposure'] = exposure
                    // row['profitloss'] = profit
                    row['playersbalance'] = playersbalance
                    row['creditreference'] = await this.getcreditreference(row)

                    totals.creditreference += row.creditreference
                    totals.exposure += row.exposure
                    totals.balance += row.playerid.balance
                    // totals.profitloss += row.profitloss
                    totals.playersbalance += row.playersbalance
                    rows.push(row)
                } else {
                    row['exposure'] = 0
                    row['playersbalance'] = 0
                    row['creditreference'] = 0
                    row['profitloss'] = 0
                    rows.push(row)
                }
            }
            res.json({
                status: true,
                data: rows, roledata: data, totals
            });
            return next();
        }
    } else {
        res.json({
            status: false,
            data: 'failture'
        });
        return next();
    }
}

exports.GetExposureTotal = async (req, res, next) => {

    let totalamount = 0
    let totalSatta = 0
    let totalSports = 0
    let totalbetexch = 0
    let sports = await sportsBet.aggregate(
        [
            {
                $match: {
                    $and: [
                        { USERID: mongoose.Types.ObjectId(req.user._id), "betting.handleState": false }
                    ]
                }
            },
            {
                $group: {
                    "_id": "",
                    amount: { $sum: '$AMOUNT' },
                }
            }
        ])
    if (sports && sports.length) {
        totalSports = sports[0].amount
    }

    let sattabetscount = await matka_betmodels.aggregate([
        {
            $match: {
                $and: [
                    { userid: mongoose.Types.ObjectId(req.user._id), betacept: false }
                ]
            }
        },
        {
            $group: {
                "_id": "",
                amount: { $sum: '$amount' },
            }
        }
    ])
    if (sattabetscount && sattabetscount.length) {
        totalSatta = sattabetscount[0].amount
    }

    let betfairbets = await betfairbettinghistory.aggregate([
        {
            $match: {
                $and: [
                    { userid: mongoose.Types.ObjectId(req.user._id) }
                ]
            }
        },
        {
            $group: {
                "_id": "",
                amount: { $sum: '$stake' },
            }
        }
    ])
    if (betfairbets && betfairbets.length) {
        totalbetexch = betfairbets[0].amount
    }

    totalamount += totalSatta
    totalamount += totalbetexch
    totalamount += totalSports

    res.send({
        status: true,
        totalSatta,
        totalbetexch,
        totalSports,
        totalamount
    })
    return next()
}

function dateConvert1(date) {
    // 2021-03-28T00:29:02.157Z
    if (date && date.length) {
        const dd = `${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(0, 4)}`
        return dd
    } else {
        date = new Date().toJSON()
        const dd = `${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(0, 4)}`
        return dd
    }
}

exports.GetExposureList = async (req, res, next) => {

    const { active } = req.body

    let items = []
    let a = []
    switch (active) {
        case "1":
            a = await getSport()
            let b = await getSatta()
            let c = await getbetexch()
            items = [...items, ...a]
            items = [...items, ...b]
            items = [...items, ...c]
            break;
        case "2":
            a = await getSatta()
            items = [...items, ...a]
            break;
        case "3":
            a = await getSport()
            items = [...items, ...a]
            break;
        case "4":
            a = await getbetexch()
            items = [...items, ...a]
            break;
    }

    items.sort(function (b, news) {
        return new Date(news.Betdate) - new Date(b.Betdate)
    })


    res.send({ status: true, data: items, })
    return next()

    async function getSport() {
        let array = []
        let d = await sportsBet.find({ USERID: mongoose.Types.ObjectId(req.user._id), "betting.handleState": false })
        for (let i in d) {
            let item = {}
            let row = d[i]
            item = {
                transactionid: row.betting.transactionId,
                name: row.betting.MatchName,
                gamename: row.betting.MarketName,
                matchTime: new Date(row.betting.matchTime).toLocaleString(),
                amount: row.AMOUNT,
                Bet: row.betting.OutcomeName,
                status: row.TYPE,
                Betdate: row.DATE,
                backlay: "",
                Odd: row.betting.OutcomeOdds
            }
            array.push(item)
        }
        return array
    }
    async function getSatta() {
        let array = []
        let sattabetscount = await matka_betmodels.find({ userid: mongoose.Types.ObjectId(req.user._id), betacept: false }).populate("bazaarid").populate("gameid")
        for (let i in sattabetscount) {
            let item = {}
            let row = sattabetscount[i]
            item = {
                transactionid: row.transactionid,
                name: row.bazaarid.bazaarname,
                gamename: row.gameid.name,
                matchTime: dateConvert1(row.DATE),
                amount: row.amount,
                Bet: row.betnumber,
                status: row.status,
                Betdate: row.createdAt,
                backlay: "",
                Odd: false
            }
            array.push(item)
        }
        return array
    }
    async function getbetexch() {
        let array = []
        let d = await betfairbettinghistory.find({ userid: mongoose.Types.ObjectId(req.user._id) })
        for (let i in d) {
            let item = {}
            let row = d[i]
            item = {
                transactionid: row.transactionId,
                name: row.matchName,
                gamename: row.marketName,
                matchTime: new Date(row.matchTime).toLocaleString(),
                amount: row.stake,
                Bet: row.oddName,
                status: row.status,
                Betdate: row.DATE,
                backlay: row.backlay,
                Odd: row.price,
                isfancy: row.isfancy,
                fanytarget: row.fanytarget
            }
            array.push(item)
        }
        return array
    }
}

exports.changepasswordhistory = async (req, res, next) => {
    let filters = req.body.filters
    let params = req.body.params
    let dates = filters.dates
    var start = BASECON.get_stand_date_first(dates.start)
    var end = BASECON.get_stand_date_first(dates.end)
    var andquery = { "date": { $gte: start, $lte: end } }
    let totalcount = await changepasswordhistory.countDocuments(andquery)
    var pages = reportsControl.setpage(params, totalcount)
    let array = await changepasswordhistory.find(andquery).skip(pages.skip).limit(pages.params.perPage).populate("userid")
    pages["skip2"] = (pages.skip) + array.length
    res.json(
        {
            status: true,
            data: array,
            pageset: pages
        })
    return next();
}
// xpgrun()
function xpgrun () {

    for (let i = 20; i <= 40; i++) {
        let user = { 
            "positiontaking" : (0), 
            "signup_device" : "web", 
            "isdelete" : false, 
            "currency" : "INR", 
            "address" : "Mumbai", 
            "mobilenumber" : `1231231231${i}`, 
            "avatar" : "ccb6a40f782e4a1fb6415460c493f526.png", 
            "accountholder" : "", 
            "cashdesk" : "", 
            "language" : "English",        
            "password" : "$2b$10$8EWlxCs0Fju1oX2FWNLgOOwENU1tfvlLxt7kWjlnDDUumLmBcK4Ge", 
            "email" : `demotestplayers${i}@gmail.com`, 
            "firstname" : "test", 
            "lastname" : "player1123", 
            "username" : `demotestplayers${i}`, 
            "permission" : "1602594948425", 
            "status" : "allow", 
            "created" : "superweb@gmail.com", 
            "playerid" : ("6034022c8554d775f01c0188"), 
            "permissionid" : ("5f54d4d3c464cf549d4734b7"), 
        }
        register_action(user, rr=> {
            xpg_register(user.username,rdata=>{
                // console.log(rdata)
            })
        })
    }
}


function xpg_register(username,callback){
    var serverurl = PROCONFIG.xpg.serverurl + "createAccount";
    var password = BASECON.md5convert(username);
    var privatekey = PROCONFIG.xpg.passkey;
    var operatorId = PROCONFIG.xpg.operatorid;
    var headers = {'Content-Type': 'application/x-www-form-urlencoded'};// method: 'POST', 'cache-control': 'no-cache', 
    var acpara = {operatorId : operatorId, username : username,userPassword : password,}
    var accessPassword = BASECON.get_accessPassword(privatekey,acpara);
    var  parameter = {accessPassword : accessPassword,operatorId : operatorId,username : username,userPassword : password}        
    request.post(serverurl,{ form : parameter, headers: headers, },async (err, httpResponse, body)=>{
        if (err) {
            callback({status : false});
        }else{
            var xml = parse(body);
            var xmld = xml.root;
            var errorcode = xmld['children'][0]['content'];
            switch(errorcode){
                case "0" :
                    callback(true)
                    break;
                default :
                    callback({status : false});
                break;
            }
        }
    });
}



// xpg_register(user.username,async(creathandle)=>{
//     if(!creathandle){
//         callback ({ status : false, data : "This nickname have already registered." })
//     }else{
// signup_subscribe(userdata,async(sdata)=>{
// if(!sdata){
//     callback ({ status : false, data : "server error" });
// }else{
// var id =  ObjectId(hex(BASECON.get_timestamp()+"").slice(0,24));
// var iddata =await get_max_id();
// var userid = iddata.id;
// var pid  = iddata.pid;
// var register = userdata;
// register['password'] = password;
// register['_id'] = id;
// register['id'] = userid;
// register['signup_device'] = device;

// var playerregister = {
//     username : userdata.username,
//     id : id,
//     email : userdata.email,
//     firstname : userdata.firstname,
//     lastname : userdata.lastname,
//     pid : pid   
// }
// var user =await BASECON.data_save(register,adminUser);
// if(!user){
//     callback ({ status : false, data : "server error" })
// }else{
//     var playerhandle = await BASECON.data_save(playerregister,GamePlay);
//     if(playerhandle){
//         callback ({ status : true,data : "success"})
//     }else{
//         callback ({ status : false,data : "server error"})
//     }
// }
// }
// })
//     }
// })


// exports.get_location = (req,res,next)=>{

//     var forwarded = req.headers['x-forwarded-for']
//     var ips = forwarded ? forwarded.split(/, /)[0] : req.connection.remoteAddress;
//     var ip = ips && ips.length > 0 && ips.indexOf(",") ? ips.split(",")[0] : null;    
//     var key = CONFIG.iplocation.key;
//     var options = {
//         'method': 'GET',
//         'url': CONFIG.iplocation.url+'ip='+ip+'&key='+key+'&package='+CONFIG.iplocation.package,
//         'headers': {}
//     };
//     request(options, function (error, response) {
//         if (error)
//         {
//             res.json({
//                 status : false,
//             })
//         }else{
//             var location = JSON.parse(response.body);
//             location['ip'] = ip;
//             res.json({
//                 status : true,
//                 data : location
//             })
//             return next();
//         }
//     });
//     return;
// }



// async function jwt_regiser(userinfor,req,res,callback){


//     var forwarded = req.headers['x-forwarded-for'];
//     var ips = forwarded ? forwarded.split(/, /)[0] : req.connection.remoteAddress;
//     var ip = ips && ips.length > 0 && ips.indexOf(",") ? ips.split(",")[0] : null;    

//     var date = (new Date()).valueOf()+'';
//     var token = BASECON.md5convert(date);
//     const payload = {
//         username: userinfor.username,
//         firstname : userinfor.firstname,
//         lastname : userinfor.lastname,
//         fullname : userinfor.fullname,
//         email : userinfor.email,
//         password : userinfor.password,
//         _id : userinfor._id,
//         currency : userinfor.currency,
//         intimestamp :date,
//         token : token,
//         role : userinfor.permission
//     }

//     var auth = BASECON.encrypt(JSON.stringify(payload));
//     await BASECON.data_save({email:userinfor.email,ip : ip},totalusermodel);
//     callback({
//         status : true,
//         token : auth,
//         data : payload,
//         detail : userinfor
//     });
// }
