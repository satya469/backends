const { FeedbackSections, FeedbackHistory } = require("../models/feedbackmodel")
const BASECON = require("./basecontroller")
const reportcontrol = require("./reportcontroller")

exports.save_menu = async (req, res, next) => {
    var indata = req.body.data;
    let order = 0;
    let topitem = await FeedbackSections.find().sort({ order: -1 }).skip(0).limit(1);
    if (topitem && topitem.length > 0) {
        order = topitem[0].order + 1;
    }
    indata['order'] = order
    var savehandle = await BASECON.data_save(indata, FeedbackSections);
    if (!savehandle) {
        res.json({ status: false, data: "fail" });
        return next();
    } else {
        this.load_menu(req, res, next)
    }
}

exports.update_menu = async (req, res, next) => {
    var indata = req.body.data;
    for (var i = 0; i < indata.length; i++) {
        var updatehandle = await BASECON.BfindOneAndUpdate(FeedbackSections, { _id: indata[i]._id }, indata[i]);
        if (!updatehandle) {
            res.json({ status: false, data: "fail" });
            return next();
        }
    }
    this.load_menu(req, res, next)
}

exports.delete_menu = async (req, res, next) => {
    var indata = req.body.data
    var outdata = await BASECON.BfindOneAndUpdate(FeedbackSections, { _id: indata._id }, { isdelete: false })
    if (outdata) {
        this.load_menu(req, res, next)
    } else {
        res.json({ status: false, data: "fail" })
        return next();
    }
}

exports.load_menu = async (req, res, next) => {
    var findhandle = "";
    findhandle = await BASECON.BSortfind(FeedbackSections, { isdelete: false }, { order: 1 });
    if (!findhandle) {
        res.json({ status: false, data: "fail" })
        return next();
    } else {
        res.json({ status: true, data: findhandle })
        return next();
    }
}

exports.getOptions = async (req, res, next) => {

    let f = await FeedbackSections.aggregate([
        {
            $match: {
                $and: [
                    { isdelete: false, status: true }
                ]
            }
        },
        {
            $sort: {
                order: 1
            }
        },
        {
            $project: {
                "label": "$label",
                "value": "$_id",
            }
        }
    ])
    if (!f) {
        res.json({ status: false, data: "fail" })
        return next();
    } else {
        res.json({ status: true, data: f })
        return next();
    }

}

exports.feedSend = async (req, res, next) => {
    let row = req.body
    if (row) {
        let ip = BASECON.get_ipaddress(req)
        row['ipaddress'] = ip
        row['useragent'] = req.headers['user-device']
        let s = await BASECON.data_save(row, FeedbackHistory)
        if (s) {
            res.send({ status: true, data: "success" })
        } else {
            res.send({ status: false, data: "fail" })
        }
    } else {
        res.send({ status: false, data: "fail" })
    }
}

exports.feedbackhistoryLoad = async (req, res, next) => {
    let filters = req.body.filters
    let params = req.body.params
    let dates = filters.dates
    var start = BASECON.get_stand_date_first(dates.start)
    var end = BASECON.get_stand_date_first(dates.end)
    var andquery = { "createAt": { $gte: start, $lte: end } }
    let totalcount = await FeedbackHistory.countDocuments(andquery)
    var pages = reportcontrol.setpage(params, totalcount)
    let array = await FeedbackHistory.find(andquery).skip(pages.skip).limit(pages.params.perPage).populate("feed")
    pages["skip2"] = (pages.skip) + array.length
    res.json(
        {
            status: true,
            data: array,
            pageset: pages
        })
    return next();
}