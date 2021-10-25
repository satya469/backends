
const { GamePlay } = require("../../models/users_model");
const UserModel = require("../../models/users_model").adminUser
const { TransactionsHistory, payoutchannel, paymentuserdetail } = require("../../models/paymentGateWayModel")
const BASECONTROL = require("../basecontroller")
const UsersControl = require("../userscontroller")
var mongoose = require('mongoose');
const ReportControl = require("../reportcontroller")
const Ruppepaycontrol = require("./Paygate10")
const PaymoroControl = require("./paymoro")
const Yaarpaycontrol = require("./YaarPay")
const rushpayControl = require("./rushpayment")
const PCONFIG = require("../../config/pconfig")
const { firstpagesetting } = require("../../models/firstpage_model")

exports.getConFig = async (type) => {
    let u = await firstpagesetting.findOne({ type: type });
    if (u) {
        return u.content;
    } else {
        return false
    }
}

exports.Payout = async (req, res, next) => {

    let data = req.body.data;
    var mainuser = BASECONTROL.getUserItem(req);
    let { status, amount } = data;

    let last_item = await BASECONTROL.BfindOne(TransactionsHistory, { _id: data._id });
    if (!last_item) {
        res.json({ status: false, data: "error" });
        return next();
    }
    let ipaddress = BASECONTROL.get_ipaddress(req)

    var Pitem = await BASECONTROL.playerFindbyUseridUpdate(data.userid);
    if (!Pitem) {
        res.json({ status: false, data: "we can't find this user" });
        return next();
    }

    if (last_item.status == PCONFIG.Pending || last_item.status == PCONFIG.OnHold) {
        if (status == PCONFIG.Reject) {
            let redata = await this.transactionupdate(data, mainuser);
            await this.balancRefund(Pitem, last_item, amount,ipaddress);
            this.admin_WithdrawHistoryLoad(req, res, next, "success")

        } else if (status == PCONFIG.Approve || status == PCONFIG.Paid ) {

            let activepayoutchannel = await payoutchannel.findOne({ status: true }).populate("paymentconfigurationid");
            if (activepayoutchannel && activepayoutchannel.paymentconfigurationid) {

                let itemuser = await BASECONTROL.BfindOne(paymentuserdetail, { userid: mongoose.Types.ObjectId(Pitem.id), paymentconfigid: mongoose.Types.ObjectId("5ff884449a092214343aa2e2") });
                if (itemuser) {
                    switch (activepayoutchannel.paymentconfigurationid.type) {

                        case "YaarPay":
                            Yaarpaycontrol.YaarPayPayout(amount, activepayoutchannel, itemuser, async (rdata) => {
                                if (rdata.status) {
                                    data["status"] = PCONFIG.Paid;
                                } else {
                                    data["status"] = PCONFIG.Reject;
                                    await this.balancRefund(Pitem, last_item, amount);
                                }
                                let redata = await this.transactionupdate(data, mainuser);
                                this.admin_WithdrawHistoryLoad(req, res, next, rdata.error)
                            })
                            break;

                        case "Paygate10":
                            Ruppepaycontrol.Paygate10Payout(last_item, activepayoutchannel.paymentconfigurationid, data, itemuser, async (rdata) => {
                                if (rdata.status) {
                                    data["status"] = PCONFIG.Paid;
                                    data["order_no"] = rdata.data;
                                } else {
                                    data["status"] = PCONFIG.Reject;
                                    data["order_no"] = last_item.order_no;
                                    await this.balancRefund(Pitem, last_item, amount);
                                }
                                let redata = await this.transactionupdate(data, mainuser);
                                this.admin_WithdrawHistoryLoad(req, res, next, rdata.error)
                            })
                            break;

                        case "Paymero":
                            PaymoroControl.payoutBankTransfer(last_item, activepayoutchannel, data, itemuser, async (rdata) => {
                                if (rdata.status) {
                                    data["status"] = PCONFIG.Paid;
                                } else {
                                    data["status"] = PCONFIG.Reject;
                                    await this.balancRefund(Pitem, last_item, amount);
                                }

                                let redata = await this.transactionupdate(data, mainuser);
                                this.admin_WithdrawHistoryLoad(req, res, next, rdata.error)
                            })
                            break;
                        case "RushPay":
                            rushpayControl.payoutRequest(last_item, activepayoutchannel, data, itemuser, async (rdata) => {
                                if (rdata.status) {
                                    data["status"] = PCONFIG.Paid;
                                } else {
                                    data["status"] = PCONFIG.Reject;
                                    await this.balancRefund(Pitem, last_item, amount);
                                }

                                let redata = await this.transactionupdate(data, mainuser);
                                this.admin_WithdrawHistoryLoad(req, res, next, rdata.error)
                            })
                            break;
                        case "RushPayUPI":
                            rushpayControl.payoutRequestRushPayUPI(last_item, activepayoutchannel, data, itemuser, async (rdata) => {
                                if (rdata.status) {
                                    data["status"] = PCONFIG.Paid;
                                } else {
                                    data["status"] = PCONFIG.Reject;
                                    await this.balancRefund(Pitem, last_item, amount);
                                }

                                let redata = await this.transactionupdate(data, mainuser);
                                this.admin_WithdrawHistoryLoad(req, res, next, rdata.error)
                            })
                            break;

                        case "cash":
                            let redata = await this.transactionupdate(data, mainuser);
                            this.admin_WithdrawHistoryLoad(req, res, next, "success");
                            break;

                        default:
                            res.json({ status: false, data: "fail" });
                            return next();
                    }

                } else {
                    res.json({ status: false, data: "Please set withdrawal bank detail about by this user" });
                    return next();
                }
            } else {
                res.json({ status: false, data: "Please active payout chnnel" });
                return next();
            }
        } else {
            data["status"] = status;
            let redata = await this.transactionupdate(data, mainuser);
            this.admin_WithdrawHistoryLoad(req, res, next, "success")
        }
    } else {
        res.json({ status: false, data: "fail" });
        return next();
    }
}


exports.transactionupdate = async (data, mainuser) => {
    var error = await TransactionsHistory.findOneAndUpdate(
        { _id: data._id },
        {
            status: data.status,
            "resultData.createdby": mainuser.email,
            comment: data.comment,
            "resultData.verify": data.verify,
            order_no: data.order_no
        }
    )

    if (error) {
        return true;
    } else {
        return false
    }
}

exports.balancRefund = async (playerItem, transitem, ipaddress) => {

    let amount = transitem.amount + transitem.commission;
    var wallets_ = {
        commission: 0,
        status: "DEPOSIT",
        roundid: transitem.order_no,
        transactionid: transitem.order_no,
        userid: mongoose.Types.ObjectId(playerItem.id),
        debited: 0,
        credited: amount,
        lastbalance: playerItem.balance,
        paymentid: mongoose.Types.ObjectId(transitem._id),
        ipaddress
    }
    var error2 = await BASECONTROL.email_balanceupdate(playerItem.email, amount, wallets_);
    return true;
}


exports.deposittransactionHistoryLoad = async (req, res, next) => {



    let user = req.user;
    let data = req.body.row;
    let params = req.body.params;
    let start = BASECONTROL.get_stand_date_end(data.start);
    let end = BASECONTROL.get_stand_date_end(data.end);

    let andquery = { createDate: { $gte: start, $lte: end }, userid: mongoose.Types.ObjectId(user._id), wallettype: "DEPOSIT" }
    var rows = [];

    let totalcount = await TransactionsHistory.countDocuments(andquery);
    var pages = ReportControl.setpage(params, totalcount);

    if (totalcount > 0) {
        rows = await TransactionsHistory.find(andquery, "amount comment createDate lastbalance updatedbalance status type commission").sort({ createDate: -1 }).skip(pages.skip).limit(pages.params.perPage);
    }
    pages["skip2"] = (pages.skip) + rows.length;

    res.json({ status: true, data: rows, pageset: pages, });
    return next();
}

exports.admindeposittransactionHistoryLoadTotal = async (req, res, next) => {

    let filters = req.body.filters;
    let dates = filters.dates;
    let userslist = [];
    let orquery = [];
    let andquery = [];
    var useroptions = [{ "label": "All", value: "" }];

    if (dates.length > 2) {
        return res.send({ status: false, error: "Please provide date." });
    }

    var start = BASECONTROL.get_stand_date_first(dates.start);
    var end = BASECONTROL.get_stand_date_first(dates.end);
    var role = BASECONTROL.getUserItem(req)
    userslist = await UsersControl.get_users_items(role);
    for (var i in userslist) {
        orquery.push(mongoose.Types.ObjectId(userslist[i]._id))
    }
    var statusoptions = [
        { label: "All", value: "" }
    ];

    let tconfig = PCONFIG;
    for (let i in tconfig) {
        statusoptions.push({ value: tconfig[i], label: tconfig[i] });
    }
    if (orquery.length > 0) {

        andquery = [{ createDate: { $gte: start, $lte: end }, "resultData.auto": { $ne: true }, userid: { $in: orquery } }];

        let betuser = await TransactionsHistory.aggregate(
            [
                {
                    $match:
                    {
                        $and: andquery,
                    },
                },
                {
                    $group:
                    {
                        _id: "$userid",
                    }
                },
                {
                    "$lookup": {
                        "from": "user_users",
                        "localField": "_id",
                        "foreignField": "_id",
                        "as": "user"
                    }
                },
                { "$unwind": "$user" },
                {
                    "$project": {
                        label: '$user.username',
                        value: "$user._id",
                    }
                }
            ]
        )

        useroptions = [...useroptions, ...betuser];
    }

    var paymentgatewayoptions = [
        { label: "All", value: "" },
        { label: "admin", value: "admin" },
        { label: "YaarPay", value: "YaarPay" },
        { label: "Paygate10", value: "Paygate10" },
        { label: "Paymero", value: "Paymero" },
        { label: "RushPay", value: "RushPay" },
    ];
    res.json(
        {
            status: true,
            data: { useroptions, statusoptions, paymentgatewayoptions },
        })
    return next();
}

exports.admindeposittransactionHistoryLoad = async (req, res, next) => {


    let params = req.body.params;
    let filters = req.body.filters;
    if (params && filters) {
        let array = [];
        let orquery = [];
        let andquery = [];
        let mainuser = req.user;
        let userid = filters.userid;
        let status = filters.status;
        let dates = filters.dates;
        let amount = filters.amount;
        let wallettype = filters.wallettype;
        let paymentgateway = filters.paymentgateway;
        if (dates.length > 2) {
            return res.send({ status: false, error: "Please provide date." });
        }
        var start = BASECONTROL.get_stand_date_first(dates.start);
        var end = BASECONTROL.get_stand_date_first(dates.end);
        let pages = {};
        if (userid && userid.length > 0) {
            orquery.push(mongoose.Types.ObjectId(userid))
        } else {
            let userslist = await UsersControl.get_users_items(mainuser);
            for (var i in userslist) {
                orquery.push(mongoose.Types.ObjectId(userslist[i]._id))
            }
        }

        andquery = {
            createDate: {
                $gte: start,
                $lte: end
            },
            userid: {
                $in: orquery
            },
            "resultData.auto": {
                $ne: true
            },
            wallettype: {
                $regex: wallettype
            },
            status: {
                $regex: status
            },
            type: {
                $regex: paymentgateway
            }
        };


        if (orquery.length > 0) {
            let totalcount = await TransactionsHistory.countDocuments(andquery);
            pages = ReportControl.setpage(params, totalcount);
            if (totalcount > 0) {
                array = await TransactionsHistory.find(andquery).skip(pages.skip).limit(pages.params.perPage).populate("userid").sort({ createDate: -1 });
            }
        } else {
            pages = ReportControl.setpage(params, 0);
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

exports.withdrawalCancel = async (req, res, next) => {
    let { data } = req.body;
    let user = req.user;
    let playeritem = await BASECONTROL.playerFindByid(user._id);
    if (playeritem) {
        let ipaddress = BASECONTROL.get_ipaddress(req)

        let order_no = new Date().valueOf();
        let amount = data.amount + data.commission;
        var wallets_ = {
            commission: 0,
            status: "DEPOSIT",
            roundid: order_no,
            transactionid: order_no,
            userid: mongoose.Types.ObjectId(playeritem.id),
            credited: amount,
            debited: 0,
            lastbalance: playeritem.balance,
            paymentid: data._id,
            ipaddress
        }
        plcurrent = await BASECONTROL.email_balanceupdate(playeritem.email, amount, wallets_);

        let uprow = {
            updatedbalance: plcurrent,
            status: PCONFIG.Reject
        }

        let up = await TransactionsHistory.findOneAndUpdate({ _id: data._id }, uprow);
        if (up) {
            this.WithdrawHistoryLoad(req, res, next)
        } else {
            res.send({ status: false, data: "server error" });
            return next();
        }

    } else {
        res.send({ status: false, data: "server error" });
        return next();
    }

}

exports.WithdrawHistoryLoad = async (req, res, next) => {

    let user = req.user;
    let data = req.body.row;
    let params = req.body.params;
    let start = BASECONTROL.get_stand_date_end(data.start);
    let end = BASECONTROL.get_stand_date_end(data.end);
    let andquery = { createDate: { $gte: start, $lte: end }, userid: mongoose.Types.ObjectId(user._id), wallettype: "WITHDRAWL" }
    var rows = [];

    let totalcount = await TransactionsHistory.countDocuments(andquery);
    var pages = ReportControl.setpage(params, totalcount);

    if (totalcount > 0) {
        rows = await TransactionsHistory.find(andquery, "amount comment createDate lastbalance updatedbalance status type commission").sort({ createDate: -1 }).skip(pages.skip).limit(pages.params.perPage);
    }
    pages["skip2"] = (pages.skip) + rows.length;

    res.json({ status: true, data: rows, pageset: pages, });
    return next();

}

exports.adminwithdrawal_total = async (req, res, next) => {
    let filters = req.body.filters;
    let dates = filters.dates;
    let userid = filters.userid;
    let status = filters.status;
    var total = [];
    var userslist = [];
    var orquery = [];
    var orquery1 = [];
    var useroptions = [{ label: "All", value: "" }];
    var andquery = [];

    var statusoptions = [
        { label: "All", value: "" }
    ];

    let tconfig = req.pconfig["PaymentStatus_bool"];
    for (let i in tconfig) {
        statusoptions.push({ value: tconfig[i], label: tconfig[i] });
    }

    let start = BASECONTROL.get_stand_date_end(dates.start);
    let end = BASECONTROL.get_stand_date_end(dates.end);
    var mainuser = BASECONTROL.getUserItem(req);

    userslist = await UsersControl.get_players_items(mainuser);

    for (let i in userslist) {
        orquery1.push(mongoose.Types.ObjectId(userslist[i]._id))
    }

    if (userid && userid.length > 0) {
        let useritem = await BASECONTROL.BfindOne(UserModel, { _id: userid });
        if (useritem) {
            userslist = [];
            userslist.push(useritem)
        } else {
            return res.send({ status: false, error: "Please provide date." });
        }
    }
    for (let i in userslist) {
        orquery.push(mongoose.Types.ObjectId(userslist[i]._id))
    }

    if (status && status.length > 0) {
        andquery = [{ createDate: { $gte: start, $lte: end }, status: status, userid: { $in: orquery } }]
    } else {
        andquery = [{ createDate: { $gte: start, $lte: end }, userid: { $in: orquery } }]
    }

    if (orquery.length > 0) {

        let dd = await TransactionsHistory.aggregate([
            {
                $match: {
                    $and: andquery,
                }
            },
            {
                $group: {
                    _id: {
                        "status": "$status",
                        "wallettype": "$wallettype",
                    },
                    AMOUNT: { $sum: '$amount' },
                    COUNT: { $sum: 1 },
                }
            },
            {
                $group: {
                    _id: "$_id.wallettype",
                    "wallets": {
                        "$push": {
                            "status": "$_id.status",
                            "COUNT": "$COUNT",
                            "AMOUNT": "$AMOUNT",
                        },
                    },
                }
            }
        ]);

        let array = dd;

        for (var i in array) {
            let item = array[i]["wallets"];
            let row = {};
            for (let i in tconfig) {
                row[tconfig[i]] = { index: 0, amount: 0 }
            }
            for (let j in item) {
                row[item[j]['status']] = { index: item[j]["COUNT"], amount: item[j]["AMOUNT"] };
            }

            total.push({ type: array[i]["_id"], value: row });
        }

        let options = await this.getrealplayerscount(start, end, orquery1);
        useroptions = [...useroptions, ...options];
    }
    var paymentgatewayoptions = [
        { label: "All", value: "" },
        { label: "admin", value: "admin" },
        { label: "YaarPay", value: "YaarPay" },
        { label: "Paygate10", value: "Paygate10" },
        { label: "Paymero", value: "Paymero" },
        { label: "RushPay", value: "RushPay" },
    ];
    res.json({ status: true, data: { total, statusoptions, useroptions, paymentgatewayoptions } })
    return next();
}


exports.getrealplayerscount = async (start, end, orquery) => {
    let betuser = await TransactionsHistory.aggregate(
        [
            {
                $match:
                {
                    $and: [{ "createDate": { $gte: start, $lte: end }, userid: { $in: orquery } }],
                },
            },
            {
                $group:
                {
                    _id: "$userid",
                }
            },
            {
                "$lookup": {
                    "from": "user_users",
                    "localField": "_id",
                    "foreignField": "_id",
                    "as": "user"
                }
            },
            { "$unwind": "$user" },
            {
                "$project": {
                    label: '$user.username',
                    value: "$user._id",
                }
            }
        ]
    )

    return betuser;
}

exports.admin_WithdrawHistoryLoad = async (req, res, next, string = null) => {

    let filters = req.body.filters;
    let params = req.body.params;
    let dates = filters.dates;
    let userid = filters.userid;
    let status = filters.status;
    let paymentgateway = filters.paymentgateway;

    let array = [];
    var andquery = {}
   
    var start = BASECONTROL.get_stand_date_first(dates.start);
    var end = BASECONTROL.get_stand_date_first(dates.end);
    var mainuser = BASECONTROL.getUserItem(req);
    let orquery = [];

    if (userid && userid.length) {
        orquery.push(mongoose.Types.ObjectId(userid))
    } else {
        userslist = await UsersControl.get_players_items(mainuser)
        for (var i in userslist) {
            orquery.push(mongoose.Types.ObjectId(userslist[i]._id))
        }
    }
    // if (status && status.length > 0) {
    //     andquery = { "createDate": { $gte: start, $lte: end }, wallettype: "WITHDRAWL", status: status }
    // } else {
    //     andquery = { createDate: { $gte: start, $lte: end }, wallettype: "WITHDRAWL" }
    // }
    andquery = {
        createDate: {
            $gte: start,
            $lte: end
        },
        userid: {
            $in: orquery
        },
        wallettype: {
            $regex: "WITHDRAWL"
        },
        status: {
            $regex: status
        },
        type: {
            $regex: paymentgateway
        }
    };


   

    let totalcount = await TransactionsHistory.countDocuments(andquery)
    pages = ReportControl.setpage(params, totalcount);
    if (totalcount > 0) {
        array = await TransactionsHistory.find(andquery).populate("userid").sort({ createDate: -1 }).skip(pages.skip).limit(pages.params.perPage);
    }
    pages["skip2"] = (pages.skip) + array.length;

    res.json(
        {
            status: true,
            data: array,
            pageset: pages,
            error: string
        })
    return next();
}

exports.cashpayout = async (req, res, next) => {

    var payoutdetail = req.body.payoutdetail;
    var paymentmenuid = req.body.paymentmenuid;

    var order_no = new Date().valueOf();
    var indata = req.body.data;
    var email = req.user.email;
    var userid = req.user._id;

    if (!payoutdetail || !paymentmenuid) {
        res.json({ status: false, data: 'fail' })
        return next()
    }
    let ipaddress = BASECONTROL.get_ipaddress(req)


    var p_item = await BASECONTROL.playerFindbyUseridUpdate(userid);
    if (!p_item) {
        res.json({ status: false, data: 'fail' })
        return next()
    }

    indata.amount = parseInt(indata.amount);
    if (parseInt(indata.amount) > p_item.balance) {
        res.json({ status: false, data: 'Insufficient funds' })
        return next()
    }

    await BASECONTROL.BfindOneAndUpdate(paymentuserdetail, { userid: mongoose.Types.ObjectId(p_item.id), paymentconfigid: paymentmenuid }, { paymentData: payoutdetail });

    let percent = 0;
    let configs = await this.getConFig("WithdrawalComission");
    if (configs && configs.status) {
        percent = parseInt(configs.comission)
    }

    var commission = indata.amount * percent / 100;
    var amount = indata.amount - commission;

    let row = {};
    row["type"] = "cash";
    row["email"] = email;
    row["commission"] = commission;
    row["order_no"] = order_no;
    row["status"] = PCONFIG.Pending;
    row["amount"] = amount;
    row["wallettype"] = "WITHDRAWL";
    row["userid"] = mongoose.Types.ObjectId(p_item.id);
    row["lastbalance"] = p_item.balance;

    let transrow = new TransactionsHistory(row);

    // amount

    var wallets_ = {
        commission: commission,
        status: "WITHDRAWL",
        roundid: order_no,
        transactionid: order_no,
        userid: mongoose.Types.ObjectId(p_item.id),
        debited: amount,
        credited: 0,
        lastbalance: p_item.balance,
        paymentid: mongoose.Types.ObjectId(transrow._id),
        ipaddress
    }
    var u_data = await BASECONTROL.email_balanceupdate(email, indata.amount * -1, wallets_);
    if (u_data !== false) {
        transrow["updatedbalance"] = u_data;

        var rdata = await BASECONTROL.BSave(transrow);
        if (rdata) {
            this.WithdrawHistoryLoad(req, res, next);
        } else {
            res.json({ status: false, data: 'fail' })
            return next()
        }
    } else {
        res.json({ status: false, data: 'fail' })
        return next()
    }
}

exports.deposit_withdrawl_historyload = async (req, res, next) => {

    let data = req.body.row;
    let params = req.body.params;
    let start = BASECONTROL.get_stand_date_end(data.start);
    let end = BASECONTROL.get_stand_date_end(data.end);
    var andquery = {
        createDate: { $gte: start, $lte: end }, userid: mongoose.Types.ObjectId(data.id),
    }


    let totalcount = await TransactionsHistory.countDocuments(andquery);
    var pages = ReportControl.setpage(params, totalcount);
    var rows = [];
    if (totalcount > 0) {
        rows = await TransactionsHistory.find(andquery).sort({ createDate: -1 }).skip(pages.skip).limit(pages.params.perPage);
    }
    pages["skip2"] = (pages.skip) + rows.length;

    res.json({ status: true, data: rows, pageset: pages, });
    return next();

}