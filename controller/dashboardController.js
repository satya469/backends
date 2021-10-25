const bethistory_model = require('../models/bethistory_model').BettingHistory_model;
const adminUser = require('../models/users_model').adminUser;
const totalusermodel = require('../models/users_model').totalusermodel;
const TransactionsHistory = require('../models/paymentGateWayModel').TransactionsHistory;
const CONFIG = require("../config/index.json");
const BASECONTROL = require("./basecontroller");
const UsersControl = require("./userscontroller");
const SessionModel = require("../models/users_model").sessionmodel;
const permission_model = require("../models/users_model").permission_model;
var mongoose = require('mongoose');
const PCONFIG = require("../config/pconfig")
const Homeconfig = require("../config/index.json")
const { matka_betmodels } = require("../models/matka_model")
const { sportsBet } = require("../models/sports_model")
const { PROVIDERMODELS, GAMELISTMODEL } = require("../models/games_model")
const SATACONFIG = require("../config/sconfig")


// async function run(){
//    let d =  await PROVIDERMODELS.updateMany({InputPercentage : 6, OutputPercentage : 12})
// }

// run()
// const PAYMENTCONFIG = require("../config/paymenterror.json")

// exports.BettingHistory_model = (dt) =>{
//     return bethistory_model.BettingHistory_model(dt);
// }

exports.get_bettingtable_prefix = (start, i) => {
    var date = new Date(start);
    var year = date.getFullYear();
    var smonth = date.getMonth() + 1;
    var addyear = parseInt((i + smonth) / 13);
    var fullyear = year + addyear;
    var addmonth = (i + smonth) % 12;
    addmonth = addmonth == 0 ? "12" : addmonth
    var fullmonth = addmonth > 9 ? addmonth : "0" + addmonth;
    var datestring = fullyear + "-" + fullmonth;
    return datestring
}

exports.get_Months = (start, end) => {
    var date1 = new Date(start);
    var date2 = new Date(end);
    var index1 = (date2.getMonth() + 1) + 1;
    var index2 = 12 - (date1.getMonth() + 1);
    var year = date2.getFullYear() - date1.getFullYear() - 1;
    var total = index1 + index2 + year * 12;
    return total;
}

exports.getMainUsers = async (mainuser, CONFIG) => {
    var m_users = [];
    m_users = await getPermissions(mainuser)
    return m_users;

    async function getPermissions(role) {
        var data = [];
        async function recurse(email) {
            var rows = await BASECONTROL.Bfind(adminUser, { isdelete: false, created: email, permission: { $ne: CONFIG.USERS.player } });
            if (rows.length == 0) {
                return;
            } else {
                for (var i = 0; i < rows.length; i++) {
                    data.push(rows[i]);
                    await recurse(rows[i].email);
                }
            }
        }

        if (BASECONTROL.SuperadminChecking(role.permission)) {
            let rows = await BASECONTROL.Bfind(adminUser, { isdelete: false, permission: { $ne: CONFIG.USERS.player } });
            data = rows;
        } else {
            data.push(role);
            await recurse(role.email);
        }
        return data;
    }
}

exports.getUserLoad = async (req, res, next) => {
    var mainuser = BASECONTROL.getUserItem(req);
    var CONFIG = req.homeConfig;
    var m_users = await this.getMainUsers(mainuser, CONFIG);
    let data = [];
    for (var i in m_users) {
        data.push({ value: m_users[i].email, label: m_users[i].email + "    " + m_users[i].permissionid.title + "    " + (100 - parseInt(m_users[i].positiontaking)) });
    }
    res.json({ status: true, data: data });
    return next();
}

exports.get_wallet_mainuser1 = async (req, res, next) => {


    var start = BASECONTROL.get_stand_date_first(req.body.startDate);
    var end = BASECONTROL.get_stand_date_end(req.body.endDate);
    var u_item = req.body.user;
    if (!u_item) {
        var user = req.user;
    } else {
        user = await BASECONTROL.BfindOne(adminUser, { email: u_item.email });
    }

    var Profit = await this.get_profit(start, end, user);
    res.send({ status: true, data: Profit });
    return next();
}

exports.getPayaoutsLoad = async (req, res, next) => {

    var start = BASECONTROL.get_stand_date_first(req.body.startDate);
    var end = BASECONTROL.get_stand_date_end(req.body.endDate);
    var u_item = req.body.user;
    if (!u_item) {
        var user = req.user;
    } else {
        user = await BASECONTROL.BfindOne(adminUser, { email: u_item.email });
    }


    if (BASECONTROL.SuperadminChecking(user.permission)) {

        let data = []
        if (user.permission == Homeconfig.USERS.superadmin) {
            data = await superadminPayouts(start, end);
        } else {
            data = await superigamezPayouts(start, end);
        }

        res.json({ status: true, data: data });
        return next()
    } else {
        res.json({ status: false, data: data });
        return next()
    }
}

const providerconfig = {
    "CASINO/SLOTS": "1",
    "LIVECASINO": "2",
    "VIRTUALGAMES": "3",
    "POKER": "4",
    "COCKFIGHT": "5",
    "ANIMAL": "6",
};
const keyprovider = {
    "1": "CASINO/SLOTS",
    "2": "LIVECASINO",
    "3": "VIRTUALGAMES",
    "4": "POKER",
    "5": "COCKFIGHT",
    "6": "ANIMAL",
}

// superigamezPayouts()
//superadminPayouts()

async function superadminPayouts(start, end) {
    // let start = new Date("2021 04 01")
    // let end = new Date("2021 05 01")

    let platformfee = await BASECONTROL.getPlatFormFee();
    let InputPercentage = 6;
    let OutputPercentage = 12;
    let ROWS = [];

    let gameproviders = {
        "compare": "Providers", "Satta": 0, "Sports": 0, "LIVECASINO": 0, "CASINO/SLOTS": 0, "VIRTUALGAMES": 0, "Exch": 0,
        "POKER": 0, "COCKFIGHT": 0, "ANIMAL": 0, "Total": 0
    }

    let PlatformFees = {
        "compare": "PlatformFees", "Satta": 0, "Sports": 0, "LIVECASINO": 0, "CASINO/SLOTS": 0, "VIRTUALGAMES": 0, "Exch": 0,
        "POKER": 0, "COCKFIGHT": 0, "ANIMAL": 0, "Total": 0
    }

    let PlatformGGR = {
        "compare": "PlatformGGR", "Satta": 0, "Sports": 0, "LIVECASINO": 0, "CASINO/SLOTS": 0, "VIRTUALGAMES": 0, "Exch": 0,
        "POKER": 0, "COCKFIGHT": 0, "ANIMAL": 0, "Total": 0
    }

    let ProfitLoss = {
        "compare": "ProfitLoss", "Satta": 0, "Sports": 0, "LIVECASINO": 0, "CASINO/SLOTS": 0, "VIRTUALGAMES": 0, "Exch": 0,
        "POKER": 0, "COCKFIGHT": 0, "ANIMAL": 0, "Total": 0
    }

    await setsatta();

    async function setsatta() {
        const sattaproviderid = "608d71caada9a646af0e6cbd"
        let sattapro = await PROVIDERMODELS.findOne({ _id: sattaproviderid });
        if (sattapro) {
            InputPercentage = sattapro.InputPercentage;
            OutputPercentage = sattapro.OutputPercentage;
        }

        let array = await matka_betmodels.aggregate([
            {
                $match: {
                    $and: [
                        {
                            "DATE": {
                                $gte: start, $lte: end
                            }
                        }
                    ]
                }
            },
            {
                $group: {
                    "_id": "$status",
                    "count": { "$sum": "$amount" },
                    "win": { "$sum": "$winamount" },
                }
            }
        ])

        if (array && array.length > 0) {
            let sattatotalggr = 0;

            let wallet = {
                bet: 0,
                win: 0,
                rollback: 0,
                void: 0,
                GGR: 0
            }

            for (var i in array) {
                let item = array[i]["_id"];
                let betam = parseInt(array[i]["count"]);
                let winam = parseInt(array[i]["win"]);
                wallet[item] += item == SATACONFIG.StatusKey.win ? winam : betam;
            }

            wallet["GGR"] = wallet.bet - wallet.win - wallet.rollback;
            sattatotalggr = parseInt(wallet["GGR"]);

            gameproviders.Satta = parseInt(sattatotalggr * (OutputPercentage / 100))
            PlatformFees.Satta = parseInt(sattatotalggr * (platformfee / 100));
            PlatformGGR.Satta = sattatotalggr;
            ProfitLoss.Satta = parseInt(sattatotalggr - (sattatotalggr * (OutputPercentage + platformfee) / 100))
        }
    }

    await setsports()
    async function setsports() {

        const sportsproviderid = "608dfd84ada9a646af0e6cc7"
        let sportspro = await PROVIDERMODELS.findOne({ _id: sportsproviderid });
        if (sportspro) {
            InputPercentage = sportspro.InputPercentage;
            OutputPercentage = sportspro.OutputPercentage;
        }

        let andquery = [{ "DATE": { $gte: start, $lte: end } }];
        let totalwallet = {
            BET: 0,
            WIN: 0,
            CANCEL: 0
        };

        let array = await sportsBet.aggregate([
            {
                $match:
                {
                    $and: andquery,
                },
            },
            {
                $group:
                {
                    _id: "$TYPE",
                    "bookCount": { "$sum": "$AMOUNT" }
                }
            },
        ]);

        if (array && array.length > 0) {

            for (var i in array) {
                totalwallet[array[i]['_id']] = parseInt(array[i]['bookCount']);
            }

            let sportsggr = totalwallet.BET - totalwallet.CANCEL - totalwallet.WIN;
            gameproviders.Sports = parseInt(sportsggr * (OutputPercentage / 100))
            PlatformFees.Sports = parseInt(sportsggr * (platformfee / 100));
            PlatformGGR.Sports = sportsggr;
            ProfitLoss.Sports = parseInt(sportsggr - (sportsggr * (OutputPercentage + platformfee) / 100))

        }

    }

    var array = await bethistory_model.aggregate([
        {
            $match:
            {
                $and: [
                    { "DATE": { $gte: start, $lte: end } }
                ]
            }
        },
        {
            $group:
            {
                _id: {
                    "providerid": "$providerid",
                    "TYPE": "$TYPE"
                },
                "bookCount": { "$sum": "$AMOUNT" }
            }
        },

        {
            "$group":
            {
                "_id": "$_id.providerid",
                "wallets": {
                    "$push": {
                        "type": "$_id.TYPE",
                        "amount": "$bookCount"
                    },
                },
            }
        },
        {
            "$lookup": {
                "from": "game_gameproviders",
                "localField": "_id",
                "foreignField": "_id",
                "as": "provider"
            }
        },
        { "$unwind": "$provider" },
    ])

    for (let i in array) {
        let bool = Object.keys(array[i].provider.bool)
        let wallets = array[i].wallets
        if (bool.length) {
            let flag = bool[0]
            getwallet(wallets, flag, array[i].provider)
        }
    }

    function getwallet(wallets, type, provider) {
        let InputPercentage = provider.InputPercentage;
        let OutputPercentage = provider.OutputPercentage;
        let totalwallet = {
            BET: 0,
            WIN: 0,
            CANCELED_BET: 0
        }
        for (let i in wallets) {
            totalwallet[wallets[i].type] = wallets[i].amount
        }
        let chggr = parseInt(totalwallet.BET - totalwallet.CANCELED_BET - totalwallet.WIN)

        gameproviders[keyprovider[type]] += parseInt(chggr * (OutputPercentage / 100))
        ProfitLoss[keyprovider[type]] += parseInt(chggr - (chggr * (OutputPercentage + platformfee) / 100))

        PlatformFees[keyprovider[type]] += parseInt(chggr * (platformfee / 100))
        PlatformGGR[keyprovider[type]] += parseInt(chggr)
    }
    // await gameprovider(providerconfig.LIVECASINO);
    // await gameprovider(providerconfig['CASINO/SLOTS']);
    // await gameprovider(providerconfig.VIRTUALGAMES);
    // await gameprovider(providerconfig.COCKFIGHT);
    // await gameprovider(providerconfig.POKER);
    // await gameprovider(providerconfig.ANIMAL);

    // async function gameprovider(type){

    //     let GaPrggr = 0;
    //     let andquery = {};
    //     andquery["bool." + type] = true;
    //     let directproviders = await PROVIDERMODELS.find(andquery)

    //     for (let i in directproviders) {
    //         // dirquery.push({ providerid : directproviders[i]._id})

    //         InputPercentage = directproviders[i].InputPercentage;
    //         OutputPercentage = directproviders[i].OutputPercentage;
    //         let datequery = [ { "DATE": { $gte: start , $lte: end }, providerid : directproviders[i]._id }];

    //         let dirarray = await bethistory_model.aggregate([
    //             {
    //                 $match : {
    //                     $and : datequery,
    //                 }
    //             },
    //             {
    //                 $group: 
    //                 {  
    //                     _id:  "$TYPE",
    //                     "bookCount": { "$sum": "$AMOUNT" }
    //                 }
    //             },
    //         ])

    //         if (dirarray && dirarray.length) {

    //             let totalwallet = {
    //                 BET : 0,
    //                 WIN : 0,
    //                 CANCELED_BET : 0
    //             };

    //             for (var j in dirarray) {
    //                 totalwallet[dirarray[j]['_id']] = parseInt(dirarray[j]['bookCount']);
    //             }

    //             let chggr = parseInt(totalwallet.BET - totalwallet.CANCELED_BET - totalwallet.WIN); 
    //             // let chggr = parseInt(totalwallet.BET - totalwallet.WIN); 
    //             GaPrggr += chggr// game provider ggr

    //             gameproviders[keyprovider[type]] += parseInt(chggr * (OutputPercentage/100))
    //             ProfitLoss[keyprovider[type]] += parseInt(chggr - (chggr * (OutputPercentage + platformfee)/100))

    //         }

    //     }

    //     if (GaPrggr > 0) {

    //         PlatformFees[keyprovider[type]] = parseInt(GaPrggr * (platformfee/100));
    //         PlatformGGR[keyprovider[type]] = parseInt(GaPrggr);
    //     }

    // }

    ROWS.push(gameproviders)
    ROWS.push(PlatformFees)
    ROWS.push(PlatformGGR)
    ROWS.push(ProfitLoss)

    let rows = [];

    for (let j in ROWS) {
        let item = ROWS[j];
        for (let i in item) {
            if (i != "compare" && i != "Total") {
                item.Total += item[i];
            }
        }
        rows.push(item)
    }


    return rows
}
async function superigamezPayouts(start, end) {

    // let start = new Date("2021 04 01")
    // let end = new Date("2021 05 01")

    let platformfee = await BASECONTROL.getPlatFormFee();
    let InputPercentage = 6;
    let OutputPercentage = 12;

    let ROWS = [];



    let rowDirect = {
        "compare": "Direct", "Satta": 0, "Sports": 0, "LIVECASINO": 0, "CASINO/SLOTS": 0, "VIRTUALGAMES": 0, "Exch": 0,
        "POKER": 0, "COCKFIGHT": 0, "ANIMAL": 0, "Total": 0
    }

    let Agregators = {
        "compare": "Agregators", "Satta": 0, "Sports": 0, "LIVECASINO": 0, "CASINO/SLOTS": 0, "VIRTUALGAMES": 0, "Exch": 0,
        "POKER": 0, "COCKFIGHT": 0, "ANIMAL": 0, "Total": 0
    }

    let Operators = {
        "compare": "Operators", "Satta": 0, "Sports": 0, "LIVECASINO": 0, "CASINO/SLOTS": 0, "VIRTUALGAMES": 0, "Exch": 0,
        "POKER": 0, "COCKFIGHT": 0, "ANIMAL": 0, "Total": 0
    }

    let ApiCommision = {
        "compare": "ApiCommission", "Satta": 0, "Sports": 0, "LIVECASINO": 0, "CASINO/SLOTS": 0, "VIRTUALGAMES": 0, "Exch": 0,
        "POKER": 0, "COCKFIGHT": 0, "ANIMAL": 0, "Total": 0
    }

    let PlatformFees = {
        "compare": "PlatformFees", "Satta": 0, "Sports": 0, "LIVECASINO": 0, "CASINO/SLOTS": 0, "VIRTUALGAMES": 0, "Exch": 0,
        "POKER": 0, "COCKFIGHT": 0, "ANIMAL": 0, "Total": 0
    }

    let PlatformGGR = {
        "compare": "PlatformGGR", "Satta": 0, "Sports": 0, "LIVECASINO": 0, "CASINO/SLOTS": 0, "VIRTUALGAMES": 0, "Exch": 0,
        "POKER": 0, "COCKFIGHT": 0, "ANIMAL": 0, "Total": 0
    }

    let ProfitLoss = {
        "compare": "ProfitLoss", "Satta": 0, "Sports": 0, "LIVECASINO": 0, "CASINO/SLOTS": 0, "VIRTUALGAMES": 0, "Exch": 0,
        "POKER": 0, "COCKFIGHT": 0, "ANIMAL": 0, "Total": 0
    }

    await setsatta();

    async function setsatta() {
        const sattaproviderid = "608d71caada9a646af0e6cbd"
        let sattapro = await PROVIDERMODELS.findOne({ _id: sattaproviderid });
        if (sattapro) {
            InputPercentage = sattapro.InputPercentage;
            OutputPercentage = sattapro.OutputPercentage;
        }

        let array = await matka_betmodels.aggregate([
            {
                $match: {
                    $and: [
                        {
                            "DATE": {
                                $gte: start, $lte: end
                            }
                        }
                    ]
                }
            },
            {
                $group: {
                    "_id": "$status",
                    "count": { "$sum": "$amount" },
                    "win": { "$sum": "$winamount" },
                }
            }
        ])


        if (array && array.length > 0) {
            let sattatotalggr = 0;

            let wallet = {
                bet: 0,
                win: 0,
                rollback: 0,
                void: 0,
                GGR: 0
            }

            for (var i in array) {
                let item = array[i]["_id"];
                let betam = parseInt(array[i]["count"]);
                let winam = parseInt(array[i]["win"]);
                wallet[item] += item == SATACONFIG.StatusKey.win ? winam : betam;
            }

            wallet["GGR"] = wallet.bet - wallet.win - wallet.rollback;
            sattatotalggr = parseInt(wallet["GGR"]);

            rowDirect.Satta = parseInt(sattatotalggr * (InputPercentage / 100))
            Agregators.Satta = 0;
            Operators.Satta = parseInt(sattatotalggr - rowDirect.Satta);
            ApiCommision.Satta = parseInt(sattatotalggr * ((OutputPercentage - InputPercentage) / 100));
            PlatformFees.Satta = parseInt(sattatotalggr * (platformfee / 100));
            PlatformGGR.Satta = sattatotalggr;
            ProfitLoss.Satta = parseInt(ApiCommision.Satta + PlatformFees.Satta);
        }
    }
    await setsports()
    async function setsports() {

        const sportsproviderid = "608dfd84ada9a646af0e6cc7"
        let sportspro = await PROVIDERMODELS.findOne({ _id: sportsproviderid });
        if (sportspro) {
            InputPercentage = sportspro.InputPercentage;
            OutputPercentage = sportspro.OutputPercentage;
        }

        let andquery = [{ "DATE": { $gte: start, $lte: end } }];
        let totalwallet = {
            BET: 0,
            WIN: 0,
            CANCEL: 0
        };

        let array = await sportsBet.aggregate([
            {
                $match:
                {
                    $and: andquery,
                },
            },
            {
                $group:
                {
                    _id: "$TYPE",
                    "bookCount": { "$sum": "$AMOUNT" }
                }
            },
        ]);

        if (array && array.length > 0) {

            for (var i in array) {
                totalwallet[array[i]['_id']] = parseInt(array[i]['bookCount']);
            }

            let sportsggr = totalwallet.BET - totalwallet.CANCEL - totalwallet.WIN;

            rowDirect.Sports = parseInt(sportsggr * (InputPercentage / 100))
            Agregators.Sports = 0;
            Operators.Sports = parseInt(sportsggr - rowDirect.Sports);
            ApiCommision.Sports = parseInt(sportsggr * ((OutputPercentage - InputPercentage) / 100));
            PlatformFees.Sports = parseInt(sportsggr * (platformfee / 100));
            PlatformGGR.Sports = parseInt(sportsggr);
            ProfitLoss.Sports = parseInt(ApiCommision.Sports + PlatformFees.Sports);

        }

    }


    await casinobets()

    async function casinobets() {
        var array = await bethistory_model.aggregate([
            {
                $match:
                {
                    $and: [
                        { "DATE": { $gte: start, $lte: end } }
                    ]
                }
            },
            {
                $group:
                {
                    _id: {
                        "providerid": "$providerid",
                        "TYPE": "$TYPE"
                    },
                    "bookCount": { "$sum": "$AMOUNT" }
                }
            },

            {
                "$group":
                {
                    "_id": "$_id.providerid",
                    "wallets": {
                        "$push": {
                            "type": "$_id.TYPE",
                            "amount": "$bookCount"
                        },
                    },
                }
            },
            {
                "$lookup": {
                    "from": "game_gameproviders",
                    "localField": "_id",
                    "foreignField": "_id",
                    "as": "provider"
                }
            },
            { "$unwind": "$provider" },
        ])

        for (let i in array) {
            let bool = Object.keys(array[i].provider.bool)
            let wallets = array[i].wallets
            if (bool.length) {
                let flag = bool[0]
                getwallet(wallets, flag, array[i].provider)
            }
        }

        function getwallet(wallets, type, provider) {
            let InputPercentage = provider.InputPercentage;
            let OutputPercentage = provider.OutputPercentage;
            let totalwallet = {
                BET: 0,
                WIN: 0,
                CANCELED_BET: 0
            }
            for (let i in wallets) {
                totalwallet[wallets[i].type] = wallets[i].amount
            }
            let chggr = parseInt(totalwallet.BET - totalwallet.CANCELED_BET - totalwallet.WIN)

            // ApiCommision[keyprovider[type]] += parseInt(chggr * ((OutputPercentage - InputPercentage) / 100));

            PlatformFees[keyprovider[type]] += parseInt(chggr * (platformfee / 100));
            PlatformGGR[keyprovider[type]] += parseInt(chggr)

            //direct
            if (provider.Route) {
                rowDirect[keyprovider[type]] += parseInt(chggr * (InputPercentage / 100));
            } else {
                //agregators
                Agregators[keyprovider[type]] += parseInt(chggr * (InputPercentage / 100));
            }

            ApiCommision[keyprovider[type]] += parseInt(chggr * ((OutputPercentage - InputPercentage) / 100));

            Operators[keyprovider[type]] += parseInt(chggr - (chggr * (InputPercentage / 100)));
            ProfitLoss[keyprovider[type]] += parseInt((chggr * ((OutputPercentage - InputPercentage) / 100)) + (chggr * (platformfee / 100)));
        }
    }


    // await gameprovider(providerconfig.LIVECASINO);
    // await gameprovider(providerconfig['CASINO/SLOTS']);
    // await gameprovider(providerconfig.VIRTUALGAMES);
    // await gameprovider(providerconfig.COCKFIGHT);
    // await gameprovider(providerconfig.POKER);
    // await gameprovider(providerconfig.ANIMAL);

    // async function gameprovider(type) {

    //     let GaPrggr = 0;
    //     let andquery = {};
    //     andquery["bool." + type] = true;
    //     andquery['Route'] = true;
    //     let directproviders = await PROVIDERMODELS.find(andquery)
    //     andquery['Route'] = false;
    //     let agregatorsproviders = await PROVIDERMODELS.find(andquery)

    //     for (let i in directproviders) {
    //         // dirquery.push({ providerid : directproviders[i]._id})

    //         InputPercentage = directproviders[i].InputPercentage;
    //         OutputPercentage = directproviders[i].OutputPercentage;
    //         let datequery = [{ "DATE": { $gte: start, $lte: end }, providerid: directproviders[i]._id }];

    //         let dirarray = await bethistory_model.aggregate([
    //             {
    //                 $match: {
    //                     $and: datequery,
    //                 }
    //             },
    //             {
    //                 $group:
    //                 {
    //                     _id: "$TYPE",
    //                     "bookCount": { "$sum": "$AMOUNT" }
    //                 }
    //             },
    //         ])

    //         if (dirarray && dirarray.length) {

    //             let totalwallet = {
    //                 BET: 0,
    //                 WIN: 0,
    //                 CANCELED_BET: 0
    //             };

    //             for (var j in dirarray) {
    //                 totalwallet[dirarray[j]['_id']] = parseInt(dirarray[j]['bookCount']);
    //             }

    //             let chggr = parseInt(totalwallet.BET - totalwallet.CANCELED_BET - totalwallet.WIN)
    //             // let chggr = parseInt(totalwallet.BET - totalwallet.WIN)
    //             GaPrggr += chggr;// game provider ggr
    //             rowDirect[keyprovider[type]] += parseInt(chggr * (InputPercentage / 100));
    //             ApiCommision[keyprovider[type]] += parseInt(chggr * ((OutputPercentage - InputPercentage) / 100));

    //         }

    //     }

    //     for (let i in agregatorsproviders) {

    //         InputPercentage = agregatorsproviders[i].InputPercentage;
    //         OutputPercentage = agregatorsproviders[i].OutputPercentage;

    //         let datequery = [{ "DATE": { $gte: start, $lte: end }, providerid: agregatorsproviders[i]._id }];

    //         // agtquery.push({ providerid : agregatorsproviders[i]._id})

    //         let agtarray = await bethistory_model.aggregate([
    //             {
    //                 $match: {
    //                     $and: datequery,
    //                 }
    //             },
    //             {
    //                 $group:
    //                 {
    //                     _id: "$TYPE",
    //                     "bookCount": { "$sum": "$AMOUNT" }
    //                 }
    //             },
    //         ])

    //         if (agtarray && agtarray.length) {
    //             let totalwallet = {
    //                 BET: 0,
    //                 WIN: 0,
    //                 CANCELED_BET: 0
    //             };

    //             for (var j in agtarray) {
    //                 totalwallet[agtarray[j]['_id']] += parseInt(agtarray[j]['bookCount']);
    //             }

    //             let chggr = parseInt(totalwallet.BET - totalwallet.CANCELED_BET - totalwallet.WIN)
    //             // let chggr = parseInt(totalwallet.BET - totalwallet.WIN)
    //             GaPrggr += chggr;// game provider ggr
    //             Agregators[keyprovider[type]] += parseInt(chggr * (InputPercentage / 100));
    //             ApiCommision[keyprovider[type]] += parseInt(chggr * ((OutputPercentage - InputPercentage) / 100));
    //         }

    //     }


    //     if (GaPrggr > 0) {

    //         Operators[keyprovider[type]] = parseInt(GaPrggr - rowDirect[keyprovider[type]]);
    //         PlatformFees[keyprovider[type]] = parseInt(GaPrggr * (platformfee / 100));
    //         PlatformGGR[keyprovider[type]] = parseInt(GaPrggr);
    //         ProfitLoss[keyprovider[type]] = parseInt(ApiCommision[keyprovider[type]] + PlatformFees[keyprovider[type]]);
    //     }

    // }


    ROWS.push(rowDirect)
    ROWS.push(Agregators)
    ROWS.push(Operators)
    ROWS.push(ApiCommision)
    ROWS.push(PlatformFees)
    ROWS.push(PlatformGGR)
    ROWS.push(ProfitLoss)

    let rows = [];

    for (let j in ROWS) {
        let item = ROWS[j];
        for (let i in item) {
            if (i != "compare" && i != "Total") {
                item.Total += item[i];
            }
        }
        rows.push(item)
    }


    return rows
}

exports.get_wallet_mainuser2 = async (req, res, next) => {

    var start = BASECONTROL.get_stand_date_first(req.body.startDate);
    var end = BASECONTROL.get_stand_date_end(req.body.endDate);
    var u_item = req.body.user;
    var user = null;
    if (!u_item) {
        user = req.user;
    } else {
        user = await BASECONTROL.BfindOne(adminUser, { email: u_item.email });
    }
    var total = await this.get_revenue_from_user(user, start, end, req);
    await res.json({ status: true, data: total });
    return next();
}

exports.get_revenue_from_user = async (user, start, end, req) => {

    async function get_deposit_withdrawal(userlistquery, start, end) {

        let trandata = await TransactionsHistory.aggregate([
            {
                $match: {
                    $and: [{ 
                        status: PCONFIG.Approve, 
                        "resultData.Bonus": 
                            {
                                $ne: true
                            }
                        , 
                        "createDate": { $gte: start, $lte: end }, 
                        userid: { $in: userlistquery } 
                    }],
                }
            },
            {
                $group: {
                    _id: { "wallettype": "$wallettype", },
                    AMOUNT: { $sum: '$amount' },
                    COUNT: { $sum: 1 },
                }
            },
        ]);

        let g_row = {
            WITHDRAWL: { amount: 0, index: 0 },
            DEPOSIT: { amount: 0, index: 0 },
        }
        for (var i in trandata) {
            g_row[trandata[i]["_id"]["wallettype"]].amount = trandata[i].AMOUNT;
            g_row[trandata[i]["_id"]["wallettype"]].index = trandata[i].COUNT;
        }

        return g_row;
    }

    var role = user;
    var total = {};
    var playersagentBalance = 0;

    var childrole = await BASECONTROL.Bfind(permission_model, { pid: role.permission, permission: { $ne: CONFIG.USERS.player } });

    let orquery = [];

    for (let i in childrole) {
        if (childrole[i].permission != CONFIG.USERS.player) {
            orquery.push({ permission: childrole[i].id })
        } else {

        }
    }


    let row = [];
    if (orquery.length > 0) {
        row = await adminUser.find(
            {
                $and: [{ created: user.email, permission: { $ne: CONFIG.USERS.player } }],
                $or: orquery
            }
        )
    }
    if (row.length > 0) {
        for (let j in row) {
            playersagentBalance += parseInt(row[j]["playerid"].balance);
        }
    }


    total = await Object.assign(total, { playersagentBalance: playersagentBalance });

    var userslist = await UsersControl.get_users_for_permission(role, start, end);
    total = await Object.assign(total, { playersRegistered: userslist.length });

    userslist = await UsersControl.get_players_items(role);


    var totallogincount = await totalusermodel.aggregate([
        { $match: { $and: [{ "date": { $gte: start, $lte: end } }] } },
        { $group: { _id: { "email": "$email" }, totallogincount: { $sum: 1 } } }
    ]);

    total = await Object.assign(total, { totallogincount: totallogincount.length });

    var Playerslogged = 0;
    var totalPlayerBalance = 0;
    var totalPlayerBonusBalance = 0;
    var MakingDepositsAmount = 0;
    var playersMakingWithdrawl = 0;
    var MakingWithdrawlAmount = 0;
    var playersMakingDeposit = 0;

    var orquery1 = [];
    var userquery = [];
    for (var i in userslist) {
        orquery1.push(userslist[i]._id)
        userquery.push(mongoose.Types.ObjectId(userslist[i]._id))

        totalPlayerBalance += userslist[i].playerid.balance;
        totalPlayerBonusBalance += userslist[i].playerid.bonusbalance;
    }


    if (orquery1.length > 0) {

        let item = await BASECONTROL.Bfind(SessionModel, { id: { $in: orquery1 } });
        if (item && item.length) {
            Playerslogged = item.length;
        }
    }

    if (userquery.length > 0) {

        let transdata = await get_deposit_withdrawal(userquery, start, end);

        MakingWithdrawlAmount += transdata['WITHDRAWL'].amount;
        MakingDepositsAmount += transdata['DEPOSIT'].amount;
        playersMakingWithdrawl += transdata['WITHDRAWL'].index;
        playersMakingDeposit += transdata['DEPOSIT'].index;
    }


    total = await Object.assign(total,
        { playersLoggedIn: Playerslogged },
        { playersBalance: totalPlayerBalance },
        { playersBonusBalance: totalPlayerBonusBalance },
        { playersMakingDeposit: playersMakingDeposit },
        { MakingDeposits: MakingDepositsAmount },
        { playersMakingWithdrawals: playersMakingWithdrawl },
        { MakingWithdrawals: MakingWithdrawlAmount });

    return total;
}

exports.get_profit = async (start, end, role) => {

    var wallet = {
        BET: 0,
        WIN: 0,
        betindex: 0,
        Profit: 0
    }

    if (BASECONTROL.SuperadminChecking(role.permission)) {
        // var roles = await BASECONTROL.Bfind(adminUser, { permission: CONFIG.USERS.supermaster, isdelete: false })

        // var positiontaking = parseInt(role.positiontaking);
        // var c_pos_tak = positiontaking > 0 && positiontaking < 100 ? (100 - positiontaking) / 100 : 0;
        // var userslist = await UsersControl.get_players_items(role);

        var totalwallet = {
            BET: 0,
            WIN: 0,
            CANCELED_BET: 0,
            betindex: 0
        }

        // var orquery = [];
        // for (var i in userslist) {
        //     orquery.push(mongoose.Types.ObjectId(userslist[i]._id))
        // }

        // if (orquery.length > 0) {
            var totals = await bethistory_model.aggregate(
                [
                    {
                        $match:
                        {
                            $and:
                                [
                                    {
                                        DATE: { $gte: start, $lte: end },
                                        AMOUNT: { $ne: 0 },
                                        // userid: {
                                        //     $in: orquery
                                        // }
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
        // }

        // var Profit = (totalwallet.BET - totalwallet.CANCELED_BET - totalwallet.WIN) * c_pos_tak;
        var Profit = (totalwallet.BET - totalwallet.CANCELED_BET - totalwallet.WIN);
        // var Profit = (totalwallet.BET  - totalwallet.WIN) * c_pos_tak;
        

        wallet["BET"] += parseInt(totalwallet.BET - totalwallet.CANCELED_BET)
        wallet["WIN"] += parseInt(totalwallet.WIN)
        wallet["Profit"] += parseInt(Profit)
        wallet["betindex"] += parseInt(totalwallet.betindex)

        // for (var i in roles) {
        // let wallet = await this.get_profit_agent(start, end, roles[i])
        // let c_profit = wallet["Profit"]
        // totalwallet["BET"] += parseInt(wallet["BET"])
        // totalwallet["WIN"] += parseInt(wallet["WIN"])
        // totalwallet["betindex"] += (wallet["betindex"])

        // var positiontaking = parseInt(roles[i].positiontaking);
        // var c_pos_tak1 = positiontaking > 0 && positiontaking < 100 ? (100 - positiontaking) / 100 : 0
        // var c_pos_tak2 = positiontaking > 0 && positiontaking < 100 ? positiontaking / 100 : 0

        // if (c_pos_tak1) {
        //     let profit = (c_profit * c_pos_tak2 / c_pos_tak1)
        //     totalwallet["Profit"] += parseInt(profit)
        // }

        // }
    } else {
        
        let agentwallet = await this.get_profit_agent(start, end, role)
        wallet["BET"] += parseInt(agentwallet["BET"])
        wallet["WIN"] += parseInt(agentwallet["WIN"])
        wallet["Profit"] += parseInt(agentwallet["Profit"])
        wallet["betindex"] += parseInt(agentwallet["betindex"])
    }

    return wallet;
}

exports.get_profit_agent = async (start, end, role) => {

    var positiontaking = parseInt(role.positiontaking);
    var c_pos_tak = positiontaking > 0 && positiontaking < 100 ? (100 - positiontaking) / 100 : 0;
    var userslist = await UsersControl.get_players_items(role);

    var totalwallet = {
        BET: 0,
        WIN: 0,
        CANCELED_BET: 0,
        betindex: 0
    }

    var orquery = [];
    for (var i in userslist) {
        orquery.push(mongoose.Types.ObjectId(userslist[i]._id))
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
                                    DATE: { $gte: start, $lte: end },
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

    var Profit = (totalwallet.BET - totalwallet.CANCELED_BET - totalwallet.WIN) * c_pos_tak;
    // var Profit = (totalwallet.BET  - totalwallet.WIN) * c_pos_tak;

    return {
        Profit: Profit,
        BET: totalwallet.BET - totalwallet.CANCELED_BET,
        // BET : totalwallet.BET ,
        WIN: totalwallet.WIN,
        betindex: totalwallet.betindex
    }
}
