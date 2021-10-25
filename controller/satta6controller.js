const USERS = require("../models/users_model");
const operators = USERS.operators;
const SATACONFIG = require("../config/sconfig")
const Sattacontrol = require("./matkaController")
const BASECONTROL = require("./basecontroller");
const Bazaar_model = require('../models/matka_model').BazaarModel;
const GameModel = require('../models/matka_model').GamesModel;
const NumbersModel = require('../models/matka_model').NumbersModel;
const Result_model = require('../models/matka_model').result_model;
const mongoose = require('mongoose');
const reportsControl = require("./reportcontroller")
const { StatusKey, StringKey, GameStringKeyId } = require("../config/sconfig")
const axios = require('axios');

// const dbConfig = require('../config/dbconfigs').db; // external network file
// const schemaFile = require('../models/sattaschemas.js'); // external schema file
// const mongooseMulti = require('mongoose-multi');
// const db = mongooseMulti.start(dbConfig, schemaFile);

// async function run()
// {
//    let d = await operators.updateMany({status : true})
// }
// run()

exports.AxiosRequest = async (url, data) => {

    var config = {
        method: 'post',
        url: url,
        data: data
    };
    let resdata = null
    await axios(config)
        .then(function (response) {
            if (response.data) {
                resdata = response.data;
            } else {
                data = { status: false };
            }
        })
        .catch(function (error) {
            data = { status: false };
        });

    return resdata
}

exports.create_result = async (req, res, next) => {

    let { data, filters } = req.body;
    if (data && filters) {

        var start = BASECONTROL.get_stand_date_first(filters.date);
        var end = BASECONTROL.get_stand_date_end1(filters.date);
        var createdate = BASECONTROL.getBazarCreateDate(filters.date);

        let { bazaarid, jodiresult, openresult, startLinetimer } = data;
        let bazarItem = await Bazaar_model.findOne({ _id: mongoose.Types.ObjectId(bazaarid) });
        if (bazarItem) {

            let last = null
            let type = bazarItem.bazaartype;
            let timers = bazarItem.timers;
            let isF = false;
            var resitem = null

            switch (type) {

                case StringKey.regular:
                    last = await Result_model.findOne({ bazaarid: bazarItem._id, resultdate: { $gte: start, $lte: end } });

                    if (!last) {
                        isF = Sattacontrol.timerChecking(timers.opentime, start);
                        if (isF) {
                            resitem = {
                                jodiresult: jodiresult,
                                closeresult: "",
                                openresult: openresult,

                            }
                            break;
                        } else {
                            res.send({ status: false, data: "It is not Bazar Anouncer time. Please wait ..." });
                            return next();
                        }
                    } else {
                        res.send({ status: false, data: "already done." });
                        return next();
                    }

                    break;

                case StringKey["king-bazaar"]:
                    last = await Result_model.findOne({ bazaarid: bazarItem._id, resultdate: { $gte: start, $lte: end } });
                    if (!last) {
                        isF = Sattacontrol.timerChecking(timers.opentime, start);
                        if (isF) {
                            resitem = {
                                jodiresult: jodiresult,
                                closeresult: "",
                                openresult: "",

                            }
                            break;
                        } else {
                            res.send({ status: false, data: "It is not Bazar Anouncer time. Please wait ..." });
                            return next();
                        }
                    } else {
                        res.send({ status: false, data: "already done." });
                        return next();
                    }

                    break;
                default:
                    last = await Result_model.findOne({ bazaarid: bazarItem._id, resultdate: { $gte: start, $lte: end }, startLinetimer: startLinetimer });
                    if (!last) {
                        // isF1 = Sattacontrol.timerChecking(timers.opentime,start)
                        isF = Sattacontrol.stbarzarTimerchecking(startLinetimer, timers, start);

                        if (isF) {
                            resitem = {
                                jodiresult: jodiresult,
                                closeresult: "",
                                openresult: openresult,
                                startLinetimer: startLinetimer,
                            }
                            break;
                        } else {
                            res.send({ status: false, data: "It is not Bazar Anouncer time. Please wait ..." });
                            return next();
                        }
                    } else {
                        res.send({ status: false, data: "already done." });
                        return next();
                    }
                    break;
            }

            resitem = Object.assign(resitem, { bazaarid: mongoose.Types.ObjectId(bazaarid) }, { bazaartype: bazarItem.bazaartype }, { resultdate: createdate });

            let save = await BASECONTROL.data_save(resitem, Result_model);
            if (save) {
                let dd = await operators.find({ status: true });

                for (let i in dd) {
                    let domainName = dd[i].domainName;
                    await this.AxiosRequest("https://cms." + domainName + "/admin/satta/createResultfromadmin", { bazarItem, data, start, end, createdate })
                }


                this.get_result(req, res, next)

            } else {
                res.send({ status: false, data: "Error" });
                return next();
            }
        } else {
            res.send({ status: false, data: "Error" });
            return next();
        }
    } else {
        res.send({ status: false, data: "Error" });
        return next();
    }
}

exports.get_result = async (req, res, next) => {

    var query = req.body.filters;
    var params = req.body.params;

    if (query && params) {
        var start = BASECONTROL.get_stand_date_first(query.date);
        var end = BASECONTROL.get_stand_date_end1(query.date);
        let options = await Bazaar_model.aggregate([{
            $match: {
                $and: [{ status: true, bazaartype: query.bazaartype, isdelete: false }]
            }
        },
        {
            $project: {
                value: "$_id",
                label: "$bazaarname",
                timer: "$timers"
            }
        }
        ])

        options.sort(function (a, b) {
            return parseInt(a.timer.opentime) - parseInt(b.timer.opentime);
        });

        let timerrows = [];
        for (let i in options) {

            let label = options[i].label;
            if (options[i].timer.opentime) {
                label += " => " + Sattacontrol.get_date(options[i].timer.opentime)
            }

            if (options[i].timer.closetime) {
                label += " : " + Sattacontrol.get_date(options[i].timer.closetime)
            }

            timerrows.push({ value: options[i].value, timer: options[i].timer, label: label, _id: options[i].value })
        }



        let numberoptions = await Sattacontrol.getNumberOptions(query.bazaartype);

        let array = [];
        let totalcount = await Result_model.countDocuments({ "resultdate": { $gte: start, $lte: end }, bazaartype: query.bazaartype });
        pages = reportsControl.setpage(params, totalcount);
        if (totalcount > 0) {
            array = await Result_model.find({ "resultdate": { $gte: start, $lte: end }, bazaartype: query.bazaartype }).populate("bazaarid").skip(pages.skip).limit(pages.params.perPage);
        }

        pages["skip2"] = (pages.skip) + array.length;
        res.send({
            status: true,
            data: array,
            pageset: pages,
            bazaars: timerrows,
            numberoptions: numberoptions
        });
        return next();

    } else {
        res.send({ status: false, data: "error" });
        return next();
    }


}

exports.update_result = async (req, res, next) => {


    let { data, filters } = req.body;
    if (data && filters) {

        var start = BASECONTROL.get_stand_date_first(filters.date);
        var end = BASECONTROL.get_stand_date_end1(filters.date);
        let { bazaarid, jodiresult, openresult, startLinetimer, closeresult } = data;
        var createdate = BASECONTROL.getBazarCreateDate(filters.date);

        let bazarItem = await Bazaar_model.findOne({ _id: mongoose.Types.ObjectId(bazaarid) });
        if (bazarItem) {
            let type = bazarItem.bazaartype;
            let andquery = { bazaarid: bazarItem._id, resultdate: { $gte: start, $lte: end } }
            if (type == StringKey.starline) {
                andquery['startLinetimer'] = startLinetimer
            }

            let last = await Result_model.findOne(andquery);
            if (last) {

                let timers = bazarItem.timers;
                let isF = false;
                let isF2 = false;
                let resitem = null

                switch (type) {

                    case StringKey.regular:
                        if (closeresult && closeresult.length) {
                            isF = Sattacontrol.timerChecking(timers.opentime, start);
                            isF2 = Sattacontrol.timerChecking(timers.closetime, start)
                            if (isF && isF2) {

                                if (last.closeresult && last.closeresult.length) {
                                    resitem = {
                                        jodiresult: jodiresult,
                                        closeresult: closeresult,
                                        openresult: openresult,
                                        update: true
                                    }
                                } else {
                                    resitem = {
                                        jodiresult: jodiresult,
                                        closeresult: closeresult ? closeresult : "",
                                        openresult: openresult,
                                    }
                                }

                                break;
                            } else {
                                res.send({ status: false, data: "It is not Bazar Anouncer time. Please wait ..." });
                                return next();
                            }
                        } else {
                            isF = Sattacontrol.timerChecking(timers.opentime, start);
                            if (isF) {

                                resitem = {
                                    jodiresult: jodiresult,
                                    closeresult: closeresult ? closeresult : "",
                                    openresult: openresult,
                                }
                                break;

                            } else {
                                res.send({ status: false, data: "It is not Bazar Anouncer time. Please wait ..." });
                                return next();
                            }
                        }

                        break;

                    case StringKey["king-bazaar"]:
                        isF = Sattacontrol.timerChecking(timers.opentime, start);
                        if (isF) {
                            resitem = {
                                jodiresult: jodiresult,
                                update: true
                            }
                            break;
                        } else {
                            res.send({ status: false, data: "It is not Bazar Anouncer time. Please wait ..." });
                            return next();
                        }

                        break;
                    default:

                        isF2 = Sattacontrol.stbarzarTimerchecking(startLinetimer, timers, start);
                        if (isF2) {
                            resitem = {
                                jodiresult: jodiresult,
                                openresult: openresult,
                                startLinetimer: startLinetimer,
                                update: true
                            }
                            break;
                        } else {
                            res.send({ status: false, data: "It is not Bazar Anouncer time. Please wait ..." });
                            return next();
                        }
                        break;
                }

                let save = await BASECONTROL.BfindOneAndUpdate(Result_model, { _id: last._id }, resitem);
                if (save) {

                    let dd = await operators.find({ status: true });

                    for (let i in dd) {
                        let domainName = dd[i].domainName;
                        let ddddd = await this.AxiosRequest("https://cms." + domainName + "/admin/satta/updateResultfromadmin", { bazarItem, data, start, end, last, createdate })
                    }


                    this.get_result(req, res, next)

                } else {
                    res.send({ status: false, data: "It haven't result" });
                    return next();
                }

            } else {
                res.send({ status: false, data: "It haven't result" });
                return next();
            }
        } else {
            res.send({ status: false, data: "Error" });
            return next();
        }


    } else {
        res.send({ status: false, data: "Error" });
        return next();
    }
}

exports.delete_result = async (req, res, next) => {
    var data = req.body.data;
    var up_db = await BASECONTROL.BfindOneAndDelete(Result_model, { _id: data._id });
    if (up_db) {
        this.get_result(req, res, next);
    } else {
        res.json({ status: false, data: "fail" });
        return next();
    }
}

exports.today_result = async (req, res, next) => {

    var query = req.body.filters;
    var params = req.body.params;

    if (query && params) {
        var start = BASECONTROL.get_stand_date_first(new Date());
        var end = BASECONTROL.get_stand_date_end1(new Date());
        let options = await Bazaar_model.aggregate([{
            $match: {
                $and: [{ status: true, bazaartype: query.bazaartype, isdelete: false }]
            }
        },
        {
            $project: {
                value: "$_id",
                label: "$bazaarname",
                timer: "$timers"
            }
        }
        ])

        let array = [];
        let totalcount = await Result_model.countDocuments({ "resultdate": { $gte: start, $lte: end }, bazaartype: query.bazaartype });
        pages = reportsControl.setpage(params, totalcount);
        if (totalcount > 0) {
            array = await Result_model.find({ "resultdate": { $gte: start, $lte: end }, bazaartype: query.bazaartype }).populate("bazaarid");
        }
        let numberoptions = await Sattacontrol.getNumberOptions(query.bazaartype);

        pages["skip2"] = (pages.skip) + array.length;
        res.send({
            status: true,
            data: array,
            pageset: pages,
            bazaars: options,
            numberoptions: numberoptions
        });
        return next();

    } else {
        res.send({ status: false, data: "error" });
        return next();
    }
}

exports.allresult = async (req, res, next) => {

    var query = req.body.filters;
    var params = req.body.params;

    if (query && params) {

        let options = await Bazaar_model.aggregate([{
            $match: {
                $and: [{ status: true, bazaartype: query.bazaartype, isdelete: false }]
            }
        },
        {
            $project: {
                value: "$_id",
                label: "$bazaarname",
                timer: "$timers"
            }
        }
        ])

        let array = [];

        let totalcount = await Result_model.countDocuments({ bazaartype: query.bazaartype });
        pages = reportsControl.setpage(params, totalcount);
        if (totalcount > 0) {
            array = await Result_model.find({ bazaartype: query.bazaartype }).populate("bazaarid");
        }
        let numberoptions = await Sattacontrol.getNumberOptions(query.bazaartype);

        pages["skip2"] = (pages.skip) + array.length;
        res.send({
            status: true,
            data: array,
            pageset: pages,
            bazaars: options,
            numberoptions: numberoptions
        });
        return next();

    } else {
        res.send({ status: false, data: "error" });
        return next();
    }
}

exports.revenCalc = async (req, res, next) => {

    let { row } = req.body
    if (row) {

        let start = BASECONTROL.get_stand_date_first(row.filters.date)
        let end = BASECONTROL.get_stand_date_end1(row.filters.date)

        let bazarItem = await Bazaar_model.findOne({ _id: mongoose.Types.ObjectId(row.bazaarid) })
        if (bazarItem) {

            let type = bazarItem.bazaartype
            let date = row.filters.date

            let dd = await operators.find({ status: true })
            let rows = []

            for (let i in dd) {

                let models = db[dd[i].OperatorName].matka_betmodels
                let operatorname = dd[i].OperatorName
                let item = {}

                switch (type) {
                    case StringKey.regular:
                        item = await this.regularRevenuCalc(row, bazarItem, start, end, operatorname, models)
                        break;
                    case StringKey["king-bazaar"]:
                        item = await this.KingRevenuCalc(row, bazarItem, start, end, operatorname, models)
                        break;
                    case StringKey.starline:
                        item = await this.startlineRevenuCalc(row, bazarItem, start, end, operatorname, models)
                        break;
                }
                rows.push(item)
            }

            res.json({ status: true, data: rows })
            return next()
        } else {
            res.json({ status: false })
        }
    }
}

exports.regularRevenuCalc = async (row, bazarItem, start, end, operatorname, Models) => {

    let { bazaarid, openresult, jodiresult, closeresult } = row

    if (!closeresult) {
        closeresult = ""
    }

    let ROW = {
        operator: operatorname,
        result: openresult + "-" + jodiresult + " - " + closeresult,
        "single ank": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "Jodi": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "single pana": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "double pana": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "tripple pana": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "half sangam": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "full sangam": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "total": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        percentage: 0
    }


    let singleAnkOpen = ''
    let singleAnkClose = ''


    if (bazarItem) {
        if (closeresult && closeresult.length) {
            singleAnkOpen = jodiresult.toString()[0]
            singleAnkClose = jodiresult.toString()[1]
            await open()
            await close()
        } else if (openresult && openresult.length) {
            singleAnkOpen = jodiresult.toString()
            await open()
        } else {
            return []
        }

        for (let i in ROW) {
            if (i == "half sangam" || i == "full sangam" || i == "Jodi" || i == "single ank" || i == "single pana" || i == "double pana" || i == "tripple pana") {
                ROW['total']["No of Bets"] += ROW[i]["No of Bets"]
                ROW['total']["Amount"] += ROW[i]["Amount"]
                ROW['total']["Profit Loss"] += ROW[i]["Profit Loss"]
            }
        }

        if (ROW.total.Amount > 0) {
            ROW.percentage = parseInt(ROW.total["Profit Loss"] / ROW.total.Amount * 100) + " %"
        }


        return ROW;
    } else {
        return []
    }

    async function open() {

        let SAWinUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) }, { gameid: mongoose.Types.ObjectId(GameStringKeyId["single ank"]) },
                    { time_flag: "1" },
                    { betnumber: singleAnkOpen },
                    { status: StatusKey.pending }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: '$winamount' },
                COUNT: { $sum: 1 },
            }
        }
        ])

        let SALostUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) }, { gameid: mongoose.Types.ObjectId(GameStringKeyId["single ank"]) },
                    { time_flag: "1" },
                    // {betnumber : { $ne : singleAnkOpen}},
                    { status: StatusKey.pending }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: '$amount' },
                COUNT: { $sum: 1 },
            }
        }
        ])

        ROW["single ank"]["No of Bets"] = getAMT(SALostUsers).count
        ROW["single ank"].Amount = getAMT(SALostUsers).amt
        ROW["single ank"]["Profit Loss"] = getAMT(SALostUsers).amt - getAMT(SAWinUsers).amt
        // open single Ank Win users

        let SpWinUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["single pana"]) },
                    { time_flag: "1" },
                    { betnumber: openresult },
                    { status: StatusKey.pending }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: '$winamount' },
                COUNT: { $sum: 1 },
            }
        }
        ])

        let SpLostUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["single pana"]) },
                    { time_flag: "1" },
                    // {betnumber : { $ne : openresult}},
                    { status: StatusKey.pending }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: '$amount' },
                COUNT: { $sum: 1 },
            }
        }
        ])

        ROW["single pana"]["No of Bets"] = getAMT(SpLostUsers).count
        ROW["single pana"].Amount = getAMT(SpLostUsers).amt
        ROW["single pana"]["Profit Loss"] = getAMT(SpLostUsers).amt - getAMT(SpWinUsers).amt

        // open single Pana Win users

        let DpWinUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["double pana"]) },
                    { time_flag: "1" },
                    { betnumber: openresult },
                    { status: StatusKey.pending },
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: '$winamount' },
                COUNT: { $sum: 1 },
            }
        }
        ])

        let DpLostUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["double pana"]) },
                    { time_flag: "1" },
                    // {betnumber : { $ne : openresult}},
                    { status: StatusKey.pending },
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: '$amount' },
                COUNT: { $sum: 1 },
            }
        }
        ])

        ROW["double pana"]["No of Bets"] = getAMT(DpLostUsers).count
        ROW["double pana"].Amount = getAMT(DpLostUsers).amt
        ROW["double pana"]["Profit Loss"] = getAMT(DpLostUsers).amt - getAMT(DpWinUsers).amt
        // open Double Pana Win users

        let TpWinUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["tripple pana"]) },
                    { time_flag: "1" },
                    { betnumber: openresult },
                    { status: StatusKey.pending }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: '$winamount' },
                COUNT: { $sum: 1 },
            }
        }
        ]);

        let TpLostUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["tripple pana"]) },
                    { time_flag: "1" },
                    // {betnumber : { $ne : openresult}},
                    { status: StatusKey.pending }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: '$amount' },
                COUNT: { $sum: 1 },
            }
        }
        ]);

        ROW["tripple pana"]["No of Bets"] = getAMT(TpLostUsers).count
        ROW["tripple pana"].Amount = getAMT(TpLostUsers).amt
        ROW["tripple pana"]["Profit Loss"] = getAMT(TpLostUsers).amt - getAMT(TpWinUsers).amt
        // open Tripple Pana Win users
        return true
    }

    async function close() {

        let closestatus = StatusKey.pending

        let SAWinUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["single ank"]) },
                    { time_flag: "2" },
                    { betnumber: singleAnkClose },
                    { status: closestatus }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$winamount" },
                COUNT: { $sum: 1 }
            }
        }
        ])

        let SALostUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["single ank"]) },
                    { time_flag: "2" },
                    // {betnumber : { $ne : singleAnkClose}},
                    { status: closestatus }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$amount" },
                COUNT: { $sum: 1 }
            }
        }
        ])

        ROW["single ank"]["No of Bets"] += getAMT(SALostUsers).count
        ROW["single ank"].Amount += getAMT(SALostUsers).amt
        ROW["single ank"]["Profit Loss"] += getAMT(SALostUsers).amt - getAMT(SAWinUsers).amt

        // close single Ank Win users

        let JDWinUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId.Jodi) },
                    { betnumber: jodiresult }, { status: closestatus }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$winamount" },
                COUNT: { $sum: 1 }
            }
        }
        ])

        let JDLostUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId.Jodi) },
                    // {betnumber : { $ne : jodiresult}},
                    { status: closestatus }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$amount" },
                COUNT: { $sum: 1 }
            }
        }
        ])


        ROW["Jodi"]["No of Bets"] += getAMT(JDLostUsers).count
        ROW["Jodi"].Amount += getAMT(JDLostUsers).amt
        ROW["Jodi"]["Profit Loss"] += getAMT(JDLostUsers).amt - getAMT(JDWinUsers).amt

        let SpWinUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["single pana"]) },
                    { time_flag: "2" },
                    { betnumber: closeresult },
                    { status: closestatus }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$winamount" },
                COUNT: { $sum: 1 }
            }
        }
        ])

        let SpLostUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["single pana"]) },
                    { time_flag: "2" },
                    // {betnumber : { $ne : closeresult}},
                    { status: closestatus }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$amount" },
                COUNT: { $sum: 1 }
            }
        }
        ])

        ROW["single pana"]["No of Bets"] += getAMT(SpLostUsers).count
        ROW["single pana"].Amount += getAMT(SpLostUsers).amt
        ROW["single pana"]["Profit Loss"] += getAMT(SpLostUsers).amt - getAMT(SpWinUsers).amt

        let DpWinUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) }, { gameid: mongoose.Types.ObjectId(GameStringKeyId["double pana"]) },
                    { time_flag: "2" },
                    { betnumber: closeresult },
                    { status: closestatus }
                ]
            }
        }, {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$winamount" },
                COUNT: { $sum: 1 }
            }
        }])
        let DpLostUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) }, { gameid: mongoose.Types.ObjectId(GameStringKeyId["double pana"]) },
                    { time_flag: "2" },
                    // {betnumber : { $ne : closeresult}},
                    { status: closestatus }
                ]
            }
        }, {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$amount" },
                COUNT: { $sum: 1 }
            }
        }])

        ROW["double pana"]["No of Bets"] += getAMT(DpLostUsers).count
        ROW["double pana"].Amount += getAMT(DpLostUsers).amt
        ROW["double pana"]["Profit Loss"] += getAMT(DpLostUsers).amt - getAMT(DpWinUsers).amt

        let TpWinUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["tripple pana"]) },
                    { time_flag: "2" },
                    { betnumber: closeresult },
                    { status: closestatus }
                ]
            }
        }, {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$winamount" },
                COUNT: { $sum: 1 }
            }
        }])

        let TpLostUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["tripple pana"]) },
                    { time_flag: "2" },
                    // {betnumber : { $ne : closeresult}},
                    { status: closestatus }
                ]
            }
        }, {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$amount" },
                COUNT: { $sum: 1 }
            }
        }])

        ROW["tripple pana"]["No of Bets"] += getAMT(TpLostUsers).count
        ROW["tripple pana"].Amount += getAMT(TpLostUsers).amt
        ROW["tripple pana"]["Profit Loss"] += getAMT(TpLostUsers).amt - getAMT(TpWinUsers).amt

        let halfWinUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["half sangam"]) },
                    { betnumber: openresult },
                    { "detail.betnumber": singleAnkClose },
                    { status: closestatus }
                ]
            }
        }, {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$winamount" },
                COUNT: { $sum: 1 }
            }
        }])

        let halfLostUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["half sangam"]) },
                    { status: closestatus }
                ],

            }
        }, {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$amount" },
                COUNT: { $sum: 1 }
            }
        }])

        ROW["half sangam"]["No of Bets"] += getAMT(halfLostUsers).count
        ROW["half sangam"].Amount += getAMT(halfLostUsers).amt
        ROW["half sangam"]["Profit Loss"] += getAMT(halfLostUsers).amt - getAMT(halfWinUsers).amt

        // open half  sangam Win users
        let closehalfWinUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["half sangam"]) },
                    { betnumber: closeresult },
                    { "detail.betnumber": singleAnkOpen },
                    { status: closestatus }
                ]
            }
        }, {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$winamount" },
                COUNT: { $sum: 1 }
            }
        }])

        let closehalfLostUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["half sangam"]) },
                    { status: closestatus }
                ],

            }
        }, {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$amount" },
                COUNT: { $sum: 1 }
            }
        }])

        ROW["half sangam"]["No of Bets"] += getAMT(closehalfLostUsers).count
        ROW["half sangam"].Amount += getAMT(closehalfLostUsers).amt
        ROW["half sangam"]["Profit Loss"] += getAMT(closehalfLostUsers).amt - getAMT(closehalfWinUsers).amt
        // close half sangam Pana Win users

        let fullWinUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["full sangam"]) },
                    { betnumber: openresult }, { "detail.betnumber": closeresult },
                    { status: closestatus }
                ]
            }
        }, {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$winamount" },
                COUNT: { $sum: 1 }
            }
        }])

        let fullLostUsers = await Models.aggregate([{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId["full sangam"]) },
                    { status: closestatus }
                ],

            }
        }, {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: "$amount" },
                COUNT: { $sum: 1 }
            }
        }])


        //close full sangam Pana Win users
        ROW["full sangam"]["No of Bets"] = getAMT(fullLostUsers).count
        ROW["full sangam"].Amount = getAMT(fullLostUsers).amt
        ROW["full sangam"]["Profit Loss"] = getAMT(fullLostUsers).amt - getAMT(fullWinUsers).amt
        return true
    }
}

exports.startlineRevenuCalc = async (row, bazarItem, start, end, operatorname, Models) => {

    let { bazaarid, jodiresult, openresult, startLinetimer } = row;
    if (openresult && openresult.toString().length && startLinetimer && startLinetimer.length && bazarItem) { } else {
        return []
    }

    let ROW = {
        operator: operatorname,
        result: openresult + "-" + jodiresult + " " + startLinetimer,
        "single ank": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "single pana": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "double pana": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "tripple pana": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "total": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        percentage: 0
    }

    let SAWinUsers = await Models.aggregate([{
        $match: {
            $and: [
                { DATE: { $gte: start, $lte: end } },
                { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                { gameid: mongoose.Types.ObjectId(GameStringKeyId["single ank"]) },
                { time_flag: startLinetimer },
                { betnumber: jodiresult },
                { status: StatusKey.pending }
            ]
        }
    },
    {
        $group: {
            "_id": "$userid",
            AMOUNT: { $sum: '$winamount' },
            COUNT: { $sum: 1 },
        }
    }
    ])

    let SALostUsers = await Models.aggregate([{
        $match: {
            $and: [
                { DATE: { $gte: start, $lte: end } },
                { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                { gameid: mongoose.Types.ObjectId(GameStringKeyId["single ank"]) },
                { time_flag: startLinetimer },
                // { betnumber : {$ne :  jodiresult}},
                { status: StatusKey.pending }
            ]
        }
    },
    {
        $group: {
            "_id": "$userid",
            AMOUNT: { $sum: '$amount' },
            COUNT: { $sum: 1 },
        }
    }
    ])

    ROW["single ank"]["No of Bets"] = getAMT(SALostUsers).count
    ROW["single ank"].Amount = getAMT(SALostUsers).amt
    ROW["single ank"]["Profit Loss"] = getAMT(SALostUsers).amt - getAMT(SAWinUsers).amt
    // open single ank
    let SPWinUsers = await Models.aggregate([{
        $match: {
            $and: [
                { DATE: { $gte: start, $lte: end } },
                { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                { gameid: mongoose.Types.ObjectId(GameStringKeyId["single pana"]) },
                { time_flag: startLinetimer },
                { betnumber: openresult },
                { status: StatusKey.pending }
            ]
        }
    },
    {
        $group: {
            "_id": "$userid",
            AMOUNT: { $sum: '$winamount' },
            COUNT: { $sum: 1 },
        }
    }
    ])

    let SPLostUsers = await Models.aggregate([{
        $match: {
            $and: [
                { DATE: { $gte: start, $lte: end } },
                { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                { gameid: mongoose.Types.ObjectId(GameStringKeyId["single pana"]) },
                { time_flag: startLinetimer },
                // { betnumber : { $ne : openresult}},
                { status: StatusKey.pending }
            ]
        }
    },
    {
        $group: {
            "_id": "$userid",
            AMOUNT: { $sum: '$amount' },
            COUNT: { $sum: 1 },
        }
    }
    ])

    ROW["single pana"]["No of Bets"] = getAMT(SPLostUsers).count
    ROW["single pana"].Amount = getAMT(SPLostUsers).amt
    ROW["single pana"]["Profit Loss"] = getAMT(SPLostUsers).amt - getAMT(SPWinUsers).amt
    // open single pana  Win users

    let DpWinUsers = await Models.aggregate([{
        $match: {
            $and: [
                { DATE: { $gte: start, $lte: end } },
                { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                { gameid: mongoose.Types.ObjectId(GameStringKeyId["double pana"]) },
                { time_flag: startLinetimer },
                { betnumber: openresult },
                { status: StatusKey.pending }
            ]
        }
    },
    {
        $group: {
            "_id": "$userid",
            AMOUNT: { $sum: '$winamount' },
            COUNT: { $sum: 1 },
        }
    }
    ])

    let DpLostUsers = await Models.aggregate([{
        $match: {
            $and: [
                { DATE: { $gte: start, $lte: end } },
                { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                { gameid: mongoose.Types.ObjectId(GameStringKeyId["double pana"]) },
                { time_flag: startLinetimer },
                // {betnumber : { $ne : openresult}},
                { status: StatusKey.pending }
            ]
        }
    },
    {
        $group: {
            "_id": "$userid",
            AMOUNT: { $sum: '$amount' },
            COUNT: { $sum: 1 },
        }
    }
    ])

    ROW["double pana"]["No of Bets"] = getAMT(DpLostUsers).count
    ROW["double pana"].Amount = getAMT(DpLostUsers).amt
    ROW["double pana"]["Profit Loss"] = getAMT(DpLostUsers).amt - getAMT(DpWinUsers).amt
    // open double pana  Win users

    let TPWinUsers = await Models.aggregate([{
        $match: {
            $and: [
                { DATE: { $gte: start, $lte: end } },
                { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                { gameid: mongoose.Types.ObjectId(GameStringKeyId["tripple pana"]) },
                { time_flag: startLinetimer },
                { betnumber: openresult },
                { status: StatusKey.pending }
            ]
        }
    },
    {
        $group: {
            "_id": "$userid",
            AMOUNT: { $sum: '$winamount' },
            COUNT: { $sum: 1 },
        }
    }
    ])

    let TPLostUsers = await Models.aggregate([{
        $match: {
            $and: [
                { DATE: { $gte: start, $lte: end } },
                { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                { gameid: mongoose.Types.ObjectId(GameStringKeyId["tripple pana"]) },
                { time_flag: startLinetimer },
                // {betnumber : { $ne :openresult}},
                { status: StatusKey.pending }
            ]
        }
    },
    {
        $group: {
            "_id": "$userid",
            AMOUNT: { $sum: '$amount' },
            COUNT: { $sum: 1 },
        }
    }
    ])

    ROW["tripple pana"]["No of Bets"] = getAMT(TPLostUsers).count
    ROW["tripple pana"].Amount = getAMT(TPLostUsers).amt
    ROW["tripple pana"]["Profit Loss"] = getAMT(TPLostUsers).amt - getAMT(TPWinUsers).amt

    for (let i in ROW) {
        if (i == "single ank" || i == "single pana" || i == "double pana" || i == "tripple pana") {
            ROW['total']["No of Bets"] += ROW[i]["No of Bets"]
            ROW['total']["Amount"] += ROW[i]["Amount"]
            ROW['total']["Profit Loss"] += ROW[i]["Profit Loss"]
        }
    }
    if (ROW.total.Amount > 0) {
        ROW.percentage = parseInt(ROW.total["Profit Loss"] / ROW.total.Amount * 100) + " %"
    }
    return ROW
}

function getAMT(rows) {
    let amt = 0
    let count = 0
    for (let i in rows) {
        amt += rows[i].AMOUNT
        count += rows[i].COUNT
    }
    return {
        amt: amt,
        count: count
    }
}

exports.KingRevenuCalc = async (row, bazarItem, start, end, operatorname, Models) => {
    let { bazaarid, jodiresult, } = row

    if (jodiresult && jodiresult.length) { } else {
        return []
    }

    let ROW = {
        operator: operatorname,
        result: jodiresult,
        "Jodi": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "first Digit": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "second Digit": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        "total": {
            "No of Bets": 0,
            "Amount": 0,
            "Profit Loss": 0
        },
        'percentage': 0
    }

    let firstDigit = jodiresult[0]
    let secondDigit = jodiresult[1]

    let JDWinUsers = await Models.aggregate(
        [{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId.Jodi) },
                    { betnumber: jodiresult },
                    { status: StatusKey.pending }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: '$winamount' },
                COUNT: { $sum: 1 },
            }
        }
        ])

    let JDLostUsers = await Models.aggregate(
        [{
            $match: {
                $and: [
                    { DATE: { $gte: start, $lte: end } },
                    { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                    { gameid: mongoose.Types.ObjectId(GameStringKeyId.Jodi) },
                    { status: StatusKey.pending }
                ]
            }
        },
        {
            $group: {
                "_id": "$userid",
                AMOUNT: { $sum: '$amount' },
                COUNT: { $sum: 1 },
            }
        }
        ])

    ROW["Jodi"]["No of Bets"] = getAMT(JDLostUsers).count
    ROW["Jodi"].Amount = getAMT(JDLostUsers).amt
    ROW["Jodi"]["Profit Loss"] = getAMT(JDLostUsers).amt - getAMT(JDWinUsers).amt

    // open jodi win users
    let FDWinUsers = await Models.aggregate([{
        $match: {
            $and: [
                { DATE: { $gte: start, $lte: end } },
                { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                { gameid: mongoose.Types.ObjectId(GameStringKeyId["first Digit"]) }, { betnumber: firstDigit }, { status: StatusKey.pending }
            ]
        }
    },
    {
        $group: {
            "_id": "$userid",
            AMOUNT: { $sum: '$winamount' },
            COUNT: { $sum: 1 },
        }
    }
    ])

    let FDlostUsers = await Models.aggregate([{
        $match: {
            $and: [
                { DATE: { $gte: start, $lte: end } },
                { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                { gameid: mongoose.Types.ObjectId(GameStringKeyId["first Digit"]) },
                // { betnumber : { $ne : firstDigit}},
                { status: StatusKey.pending }
            ]
        }
    },
    {
        $group: {
            "_id": "$userid",
            AMOUNT: { $sum: '$amount' },
            COUNT: { $sum: 1 },
        }
    }
    ])

    ROW["first Digit"]["No of Bets"] = getAMT(FDlostUsers).count
    ROW["first Digit"].Amount = getAMT(FDlostUsers).amt
    ROW["first Digit"]["Profit Loss"] = getAMT(FDlostUsers).amt - getAMT(FDWinUsers).amt

    let SDWinUsers = await Models.aggregate([{
        $match: {
            $and: [
                { DATE: { $gte: start, $lte: end } },
                { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                { gameid: mongoose.Types.ObjectId(GameStringKeyId["second Digit"]) },
                { betnumber: secondDigit },
                { status: StatusKey.pending }
            ]
        }
    },
    {
        $group: {
            "_id": "$userid",
            AMOUNT: { $sum: '$winamount' },
            COUNT: { $sum: 1 },
        }
    }
    ])

    let SDlostUsers = await Models.aggregate([{
        $match: {
            $and: [
                { DATE: { $gte: start, $lte: end } },
                { bazaarid: mongoose.Types.ObjectId(bazaarid) },
                { gameid: mongoose.Types.ObjectId(GameStringKeyId["second Digit"]) },
                // {betnumber : { $ne : secondDigit}},
                { status: StatusKey.pending }
            ]
        }
    },
    {
        $group: {
            "_id": "$userid",
            AMOUNT: { $sum: '$amount' },
            COUNT: { $sum: 1 },
        }
    }
    ])

    ROW["second Digit"]["No of Bets"] = getAMT(SDlostUsers).count
    ROW["second Digit"].Amount = getAMT(SDlostUsers).amt
    ROW["second Digit"]["Profit Loss"] = getAMT(SDlostUsers).amt - getAMT(SDWinUsers).amt

    for (let i in ROW) {
        if (i == "Jodi" || i == "first Digit" || i == "second Digit") {
            ROW['total']["No of Bets"] += ROW[i]["No of Bets"]
            ROW['total']["Amount"] += ROW[i]["Amount"]
            ROW['total']["Profit Loss"] += ROW[i]["Profit Loss"]
        }
    }

    if (ROW.total.Amount > 0) {
        ROW.percentage = parseInt(ROW.total["Profit Loss"] / ROW.total.Amount * 100) + " %"
    }
    return ROW
}

async function getoperators(Models, start, end, operatoritem) {

    // let operatorname = "fairbets"
    // let start = new Date("2021 04 01")
    // let end = new Date("2021 05 01")

    let ROW = {
        operatorname: operatoritem.OperatorName,
        'regular': {
            bets: 0,
            amt: 0,
            ggr: 0,
        },
        "king-bazaar": {
            bets: 0,
            amt: 0,
            ggr: 0,
        },
        'starline': {
            bets: 0,
            amt: 0,
            ggr: 0,
        },
        'total': {
            bets: 0,
            amt: 0,
            ggr: 0,
        },
        'profit': {
            profit: 0,
            percentage: 0
        },
    }

    andquery = [{ "DATE": { $gte: start, $lte: end } }];

    let array = await Models.aggregate([{
        $match: {
            $and: andquery,
        },
    },
    {
        $group: {
            _id: {
                "type": "$type",
                "status": "$status"
            },
            "bookCount": { "$sum": "$amount" },
            "winCount": { "$sum": "$winamount" },
            "COUNT": { $sum: 1 },
        }
    },
    {
        "$group": {
            "_id": "$_id.type",
            "wallets": {
                "$push": {
                    "status": "$_id.status",
                    "count": "$bookCount",
                    "win": "$winCount",
                    "betscount": "$COUNT"
                },
            },
        }
    },
    ]);

    if (array && array.length > 0) {


        for (var i in array) {

            let wallet = {
                bet: 0,
                win: 0,
                rollback: 0,
                void: 0,
                GGR: 0,
                count: 0,
                amt: 0
            }

            for (var j in array[i].wallets) {

                let item = array[i]["wallets"][j]["status"];
                let betam = parseInt(array[i]["wallets"][j]["count"]);
                let winam = parseInt(array[i]["wallets"][j]["win"]);
                let betscount = parseInt(array[i]["wallets"][j]["betscount"]);

                wallet[item] = item == SATACONFIG.StatusKey.win ? winam : betam;

                SATACONFIG.StatusKey.pending == item ? wallet.count = betscount : ""
                SATACONFIG.StatusKey.pending == item ? wallet.amt = betam : ""

            }

            wallet["GGR"] = wallet.bet - wallet.win - wallet.rollback;

            ROW['total'].ggr += wallet["GGR"]
            ROW['total'].amt += wallet["bet"]
            ROW['total'].bets += wallet["count"]

            wallet['bazarname'] = SATACONFIG.KeyString[array[i]._id];

            // row = Object.assign(row,wallet);

            ROW[SATACONFIG.KeyString[array[i]._id]]['bets'] = wallet.count;
            ROW[SATACONFIG.KeyString[array[i]._id]]['ggr'] = wallet["GGR"];
            ROW[SATACONFIG.KeyString[array[i]._id]]['amt'] = wallet["amt"];

            // newrows.push(row)
        }

        ROW['profit'] = {
            profit: parseInt(ROW['total'].ggr),
            "profit percentage": parseInt((ROW['total'].ggr) / (ROW['total'].amt) * 100)
        }

    }

    return ROW
}

exports.dashboardloadbazars = async (req, res, next) => {
    var start = BASECONTROL.get_stand_date_first(req.body.startDate);
    var end = BASECONTROL.get_stand_date_end(req.body.endDate);
    let dd = await operators.find({ status: true });
    let rows = []

    for (let i in dd) {

        let models = db[dd[i].OperatorName].matka_betmodels;
        let item = await getoperators(models, start, end, dd[i])
        rows.push(item)

    }

    res.send({
        status: true,
        data: rows
    })
    return next()
}

exports.adminGetLoadBazaars = async (req, res, next) => {

    let date = req.body.date;
    let operatorName = req.body.operatorName;
    if (!date || !operatorName) {
        res.send({ status: false, data: "error" });
        return next()
    }

    let start = BASECONTROL.get_stand_date_end(date);
    let end = BASECONTROL.get_stand_date_end1(date);

    let BazarModel = db[operatorName].matka_Bazaars

    let gameList = await GameModel.find({ status: true, isdelete: false });
    let bazarList = await BazarModel.find({ status: true, isdelete: false });

    let betsObject = {
        "1": {},
        "2": {},
        "3": {}
    };

    let bazarListObject = {}

    let totalwallet = {
        amount: 0,
        count: 0,
        profit: 0,
    }

    let Models = db[operatorName].matka_betmodels;
    let ResultModel = db[operatorName].matka_results


    // let betdata = await Models.aggregate([
    //   {
    //     $match : {
    //       $and : [ 
    //         {
    //           bazaarid : mongoose.Types.ObjectId(bazaritem._id),
    //           "DATE": { $gte: start , $lte: end }
    //         }
    //       ]
    //     }
    //   },
    //   {
    //     $group : {
    //       "_id" : {
    //         gameid : "$gameid",
    //         time_flag : "$time_flag",
    //         "status" : "$status"
    //       },
    //       AMOUNT: {$sum: '$amount'},
    //       winamount: {$sum: '$winamount'},
    //       COUNT: {$sum: 1},
    //     }
    //   },
    //   {
    //     $group : {
    //       "_id"  : {
    //         gameid : "$_id.gameid",
    //         time_flag : "$_id.time_flag",
    //       },
    //       'bets' : {
    //         $push : {     
    //           "status" : "$_id.status",
    //           "count" : "$COUNT",
    //           "amount" : "$AMOUNT",
    //           "winamount" : "$winamount",
    //         }
    //       }
    //     }
    //   },
    //   {
    //     $group : {
    //       "_id"  :  "$_id.gameid",
    //       'time_flag' : {
    //         $push : {                    
    //           "time_flag" : "$_id.time_flag",
    //           "bets" : "$bets",
    //         }
    //       }
    //     }
    //   },
    // ]);

    for (var i in bazarList) {

        let bazaritem = bazarList[i];
        let type = bazaritem.bazaartype; // bazartype  You can see in sconfig

        bazarListObject[bazaritem._id] = bazarList[i];

        let resString = "- - -";
        let result = false;
        // let reitem = await Result_model.findOne({bazaarid : bazaritem._id});

        if (bazaritem.bazaartype == StringKey.starline) {
            var reitems = await BASECONTROL.Bfind(ResultModel, { "resultdate": { $gte: start, $lte: end }, bazaarid: bazaritem._id });
            if (reitems.length) {
                resString = {};
                for (let j in reitems) {
                    resString[reitems[j].startLinetimer] = reitems[j].openresult + "-" + reitems[j].jodiresult;
                }
            }

        } else {
            var reitem = await BASECONTROL.BfindOne(ResultModel, { "resultdate": { $gte: start, $lte: end }, bazaarid: bazaritem._id });
            if (reitem) {
                result = true
                resString = reitem.openresult + "-" + reitem.jodiresult + "-" + reitem.closeresult;
            }
        }

        let betdata = await Models.aggregate([{
            $match: {
                $and: [{
                    bazaarid: mongoose.Types.ObjectId(bazaritem._id),
                    "DATE": { $gte: start, $lte: end }
                }]
            }
        },
        {
            $group: {
                "_id": {
                    gameid: "$gameid",
                    time_flag: "$time_flag",
                    "status": "$status"
                },
                AMOUNT: { $sum: '$amount' },
                winamount: { $sum: '$winamount' },
                COUNT: { $sum: 1 },
            }
        },
        {
            $group: {
                "_id": {
                    gameid: "$_id.gameid",
                    time_flag: "$_id.time_flag",
                },
                'bets': {
                    $push: {
                        "status": "$_id.status",
                        "count": "$COUNT",
                        "amount": "$AMOUNT",
                        "winamount": "$winamount",
                    }
                }
            }
        },
        {
            $group: {
                "_id": "$_id.gameid",
                'time_flag': {
                    $push: {
                        "time_flag": "$_id.time_flag",
                        "bets": "$bets",
                    }
                }
            }
        },
        ]);

        betsObject[type][bazaritem._id] = {};

        let wallet = {
            bet: 0,
            win: 0,
            rollback: 0,
            void: 0,
            GGR: 0,
            count: 0,
            loss: 0
        }

        if (betdata.length) {

            let row = {};

            for (let i in betdata) {

                let gitem = betdata[i];


                if (bazaritem.bazaartype == StringKey.starline) {

                    row[gitem._id] = {};


                    for (let j in gitem['time_flag']) {

                        let child = {
                            bet: 0,
                            win: 0,
                            rollback: 0,
                            void: 0,
                            GGR: 0,
                            count: 0,
                            profit: 0,
                            loss: 0
                        }
                        let tf = gitem['time_flag'][j]['time_flag']
                        row[gitem._id][tf] = {};
                        let bets = gitem['time_flag'][j]['bets'];

                        for (let k in bets) {

                            let status = bets[k]['status'];
                            let betam = bets[k]['amount'];
                            let winam = bets[k]['winamount'];
                            let cnt = bets[k]['count'];
                            wallet[status] += status == StatusKey.win ? winam : betam;
                            wallet["count"] += status == StatusKey.pending ? cnt : 0;

                            child[status] += status == StatusKey.win ? winam : betam;
                            child["count"] += status == StatusKey.pending ? cnt : 0;

                        }
                        if (result) {
                            child["GGR"] = child.bet - child.win - child.rollback;
                        }

                        row[gitem._id][tf] = {
                            count: child.count,
                            amount: child.bet,
                            profit: child.GGR,
                            loss: child.win,
                        }
                    }


                } else {
                    row[gitem._id] = {};
                    let trows = {}
                    for (let j in gitem['time_flag']) {

                        let tf = gitem['time_flag'][j]['time_flag'];
                        trows[tf] = {}
                        let bets = gitem['time_flag'][j]['bets'];
                        let child = {
                            bet: 0,
                            win: 0,
                            rollback: 0,
                            void: 0,
                            GGR: 0,
                            count: 0,
                            profit: 0,
                            loss: 0
                        }

                        for (let k in bets) {

                            let status = bets[k]['status'];
                            let betam = bets[k]['amount'];
                            let winam = bets[k]['winamount'];
                            let cnt = bets[k]['count'];
                            wallet[status] += status == StatusKey.win ? winam : betam;
                            wallet["count"] += status == StatusKey.pending ? cnt : 0;

                            child[status] += status == StatusKey.win ? winam : betam;
                            child["count"] += status == StatusKey.pending ? cnt : 0;

                        }

                        if (result) {
                            child["GGR"] = child.bet - child.win - child.rollback;
                        }
                        trows[tf] = {
                            count: child.count,
                            amount: child.bet,
                            profit: child.GGR,
                            loss: child.win,
                        }
                    }

                    row[gitem._id] = trows
                }
                if (result) {
                    wallet["GGR"] = wallet.bet - wallet.win - wallet.rollback;
                }
            }

            totalwallet.count += wallet.count;
            totalwallet.amount += wallet.bet;
            totalwallet.profit += wallet.GGR;
            totalwallet.loss += wallet.win;

            betsObject[type][bazaritem._id] = {
                games: row,
                total: wallet,
                result: resString
            };
        } else {
            let row = {}

            let gameslist = bazaritem.gamelink;
            for (let i in gameslist) {
                if (gameslist[i].status) {
                    row[i] = {};
                }
            }

            betsObject[type][bazaritem._id] = {
                total: wallet,
                games: row,
                result: resString
            }
        }
    }



    res.json({ status: true, data: { betsObject, bazarListObject, totalwallet, gameList } });
    return next();
}

exports.getBettingPlayers = async (req, res, next) => {

    let { data, params, operatorName } = req.body;

    if (data && params && operatorName) {
        let Models = db[operatorName].matka_betmodels;

        let { bazaritem, gameitem, date } = data;

        if (bazaritem && gameitem && date) {

            let start = BASECONTROL.get_stand_date_end(date);
            let end = BASECONTROL.get_stand_date_end1(date);

            let andquery = { "DATE": { $gte: start, $lte: end }, bazaarid: bazaritem._id, gameid: gameitem._id }
            var rows = [];
            let totalcount = await Models.countDocuments(andquery);
            var pages = reportsControl.setpage(params, totalcount);
            if (totalcount > 0) {
                rows = await Models.find(andquery)
                    .populate({ path: "bazaarid", select: "bazaarname bazaartype" })
                    .populate({ path: "gameid", select: "name" }).populate({ path: "userid" }).sort({ DATE: -1 }).skip(pages.skip).limit(pages.params.perPage);
            }
            pages["skip2"] = (pages.skip) + rows.length;

            res.json({ status: true, data: rows, pageset: pages, });
            return next();
        } else {
            res.send({ status: false, data: "error" })
            return next()
        }
    } else {
        res.send({ status: false, data: "error" })
        return next()
    }
}

exports.get_bets_from_bazarr = async (req, res, next) => {

    var { bazaritem, date, operatorName } = req.body;

    let numbersData = await NumbersModel.find();

    var start = BASECONTROL.get_stand_date_first(date);
    var end = BASECONTROL.get_stand_date_end1(date);

    let Models = db[operatorName].matka_betmodels;

    let dd = await Models.aggregate([{
        $match: {
            $and: [{
                bazaarid: mongoose.Types.ObjectId(bazaritem._id),
                // status : StatusKey.,
                "DATE": { $gte: start, $lte: end }
            }],
        }
    },
    {
        $group: {
            "_id": {
                bazaarid: "$bazaarid",
                gameid: "$gameid",
                time_flag: "$time_flag",
                betnumber: "$betnumber",
                "status": "$status"
            },
            AMOUNT: { $sum: '$amount' },
            winamount: { $sum: '$winamount' },
            COUNT: { $sum: 1 },
        }
    },
    {
        $group: {

            "_id": {
                "bazaarid": "$_id.bazaarid",
                "gameid": "$_id.gameid",
                "time_flag": "$_id.time_flag",
                "betnumber": "$_id.betnumber",
            },
            "status": {
                $push: {
                    AMOUNT: "$AMOUNT",
                    winamount: "$winamount",
                    COUNT: "$COUNT",
                    status: "$_id.status"
                }
            }
        }
    },
    {
        $group: {

            "_id": {
                "bazaarid": "$_id.bazaarid",
                "gameid": "$_id.gameid",
                "time_flag": "$_id.time_flag",
            },
            "betnumbers": {
                $push: {
                    betnumber: "$_id.betnumber",
                    status: "$status"
                }
            }
        }
    },
    {
        $group: {
            "_id": {
                "bazaarid": "$_id.bazaarid",
                "gameid": "$_id.gameid",
            },
            "time_flag": {
                $push: {
                    timer: "$_id.time_flag",
                    numbers: "$betnumbers"
                }
            }
        }
    },
    {
        $group: {
            "_id": "$_id.bazaarid",
            "games": {
                $push: {
                    gameid: "$_id.gameid",
                    timers: "$time_flag"
                }
            }
        }
    },
    ]);


    if (dd.length) {
        let row = {};

        for (var i in dd) {

            row[dd[i]['_id']] = {};
            let c1 = {};
            let games = dd[i]['games'];

            for (var j in games) {

                c1[games[j]['gameid']] = {};
                let timers = games[j]['timers'];
                let c2 = {};

                for (var k in timers) {

                    c2[timers[k]['timer']] = {};
                    let numbers = timers[k]['numbers'];
                    let c3 = {};

                    for (var l in numbers) {

                        let status = numbers[l]['status'];
                        let c4 = {};

                        for (var m in status) {

                            c4[status[m]['status']] = {
                                AMOUNT: status[m].AMOUNT,
                                COUNT: status[m].COUNT,
                                winamount: status[m].winamount
                            }
                        }

                        c3[numbers[l]['betnumber']] = c4;

                    }

                    c2[timers[k]['timer']] = c3;

                }

                c1[games[j]['gameid']] = c2;

            }

            row[dd[i]['_id']] = c1;

        }
        res.send({ status: true, data: row, numbersData });
        return next()
    } else {
        res.send({ status: true, data: [], numbersData });
        return next()
    }
}

exports.checkingBazars = async (req, res, next) => {

    let rows = await Bazaar_model.find({ status: true, isdelete: false });
    if (rows.length) {
        res.send({
            status: true,
            data: rows
        })
    } else {
        res.send({
            status: false,
            data: "fail"
        })
    }

}