const axios = require('axios');
const mongoose = require("mongoose")
const { betfairSportslist, betfairBetminmax, betfairoddsSession, betfairbettinghistory, betfairSetting, betfairseriesList, betfairmatchlist, betfairmarketlist, betfairoddslist, betfairfancylist, betfairIdList } = require("../models/betfairmodel")
const BaseControl = require("./basecontroller")
const { GamePlay } = require('../models/users_model');
const ReportControl = require('../controller/reportcontroller');
const UsersControl = require('../controller/userscontroller');
const betfairsocket = require('../controller/betfairsocketapi');
// https://api2.ditelitinfo.com/api/v5/getOddsListMultiple?marketid=1.184725724,1.184725724,1.184725724,1.184725724
const Gamelist = "https://api.ditelitinfo.com/api/v5/getGamesList"
const Seriest = "https://api.ditelitinfo.com/api/v5/getSeriesList"
const Matchlist = "https://api.ditelitinfo.com/api/v5/getMatchesList"
const Marketlist = "https://api.ditelitinfo.com/api/v5/getMarketList"
const Oddslist = "https://api.ditelitinfo.com/api/v5/getOddsListMultiple"
const Fancylist = "https://api.ditelitinfo.com/api/v5/getFancyListDiamond"
const Bookmarkerlist = "https://api.ditelitinfo.com/api/v5/getOddsTnpl"
const OddslistONE = "https://api.ditelitinfo.com/api/v5/getOddsResult"

const parse = require("xml-parser");
const redis = require('redis')
const rdsconfig = require("../servers/db.json")

const redisClient = redis.createClient({
    host: rdsconfig.host,
    auth_pass: rdsconfig.auth_pass,
    port: rdsconfig.port,
    db: 2
})

const inplayredisClient = redis.createClient({
    host: rdsconfig.host,
    auth_pass: rdsconfig.auth_pass,
    port: rdsconfig.port,
    db: 3
})


var Fancylimits = {}
run()
async function run() {
    console.time()
    Fancylimits = await getFancylimits()
    // betfairsocket.authentication()
    await getBetfairData()
    await Realtimesportlist()
    await getBetfairData()
    await Realtimesportlist()
    console.timeEnd()

    setInterval( async ()=>{
        await getBetfairData()
        await Realtimesportlist()
    },900000)
}


exports.RealtimeUpdatingOddsExChangeData = async (io) => {
    

    let limits = Fancylimits
    let data = []
    let rdata = await betfairoddsSession.aggregate([
        {
            $group: {
                "_id": "$match_id",
                "sockets": {
                    $push: {
                        socketid: "$socketid",
                        series_id: "$series_id",
                        match_id: "$match_id",
                        marketId: "$marketId",
                        sport_id: "$sport_id",
                    }
                }
            }
        }
    ])
    for (let i in rdata) {

        let markets = await getmarketsAPI({ event: { id: rdata[i]._id } }, limits)
        if (markets.markets && Object.keys(markets.markets).length) {
            if (markets.markets['Match Odds']) {
                for (let j in rdata[i].sockets) {
                    io.to(rdata[i].sockets[j].socketid).emit("betexchangeRealtimeodds", { data: markets });
                }
            } else {
                // await betfairoddsSession.findOneAndDelete({ marketId: rdata[i]._id })
                // await betfairmatchlist.findOneAndUpdate({ "event.id": rdata[i]._id }, { status: false })
            }
        } else {
            // await betfairmatchlist.findOneAndUpdate({ "event.id": rdata[i]._id }, { status: false })
        }
    }
    return data

}


async function getodds(marketid) {
    let odd = await betfairoddslist.find({ marketId: marketid, status: "OPEN" })
    let rows = []
    for (let i in odd) {
        rows.push(odd[i]._doc)
    }
    return rows
}

async function admingetodds(marketid) {
    let odd = await betfairoddslist.find({ marketId: marketid })
    let rows = []
    for (let i in odd) {
        rows.push(odd[i]._doc)
    }
    return rows
}

exports.telgetSportsList = async (req, res, next) => {
    let d = await betfairSportslist.find({ status: true }).sort({ order: 1 })
    if (d) {
        res.send({ status: true, data: d })
        return next()
    } else {
        res.send({ status: false, })
        return next()
    }
}

exports.getSportsList = async (req, res, next) => {
    let d = await betfairSportslist.find().sort({ order: 1 })
    if (d) {
        res.send({ status: true, data: d })
        return next()
    } else {
        res.send({ status: false, })
        return next()
    }
}

exports.playergetsportlist = async (req, res, next) => {
    let rdata = await betfairSportslist.aggregate([{
        $match: {
            $and: [{
                status: true
            }]
        }
    },
    {
        $sort: {
            order: 1
        }
    },
    {
        "$lookup": {
            "from": "betfairbetminmaxes",
            "localField": "_id",
            "foreignField": "betfairSportslistid",
            "as": "minmaxvalue"
        }
    },
    { "$unwind": "$minmaxvalue" },

    ])
    if (rdata) {
        res.send({ status: true, data: rdata })
        return next()
    } else {
        res.send({ status: false, })
        return next()
    }
}

async function getmarketsOld(match, limits) {
    let match_id = match.event.id
    let mtArray = await betfairmarketlist.find({ match_id })
    let markets = {}
    let inplay = false
    let oddsstatus = ""
    let betstatus = false
    let hda = {
        h: {},
        d: {},
        a: {},
    }
    let bc = 0
    let fc = 0
    let bookmaker = false
    let matchoddmarketid = ""

    for (let i in mtArray) {
        let m = mtArray[i]._doc
        if (m.marketStartTime === "") {
            betstatus = false
            // continue;
        }
        if (m.marketStartTime !== "") {


        } else {
            betstatus = false
        }

        let marketName = m.marketName
        let odds = []
        let fancys = []
        if (marketName !== "Bookmaker") {
            fancys = await admingetfanys(m.marketId)
            odds = await admingetodds(m.marketId)
        }

        let oddsitems = []
        let oddsrunners = []
        if (odds.length) {
            oddsstatus = odds[0].status
            oddsrunners = odds[0].runners
        } else {

        }

        if (oddsstatus == "CLOSED" || oddsstatus == "SUSPENDED") {
            // continue;
            betstatus = false
        }

        if (oddsrunners) {
            if (oddsrunners.length) {
                if (oddsrunners[0].status == "CLOSED" || oddsrunners[0].status == "SUSPENDED") {
                    // continue;
                    betstatus = false
                }
            }
        } else {
            betstatus = false
            // continue;
        }

        for (let j in m.runners) {
            let run = m.runners[j]
            let odd = oddsrunners.find(obj => obj.selectionId.toString() == run.selectionId.toString())
            if (odd) {

                let ddd = Object.assign({}, {
                    status: odd.status,
                    totalMatched: odd.totalMatched,
                    back: arrayMinordersort(odd.ex.availableToBack),
                    lay: arrayMaxordersort(odd.ex.availableToLay),
                    name: run.runnerName,
                    marketStartTime: run.marketStartTime,
                    selectionId: run.selectionId,
                })
                oddsitems.push(ddd)

            } else {
                oddsitems.push({
                    status: "",
                    totalMatched: "",
                    back: [],
                    lay: [],
                    name: run.runnerName,
                    marketStartTime: run.marketStartTime,
                    selectionId: run.selectionId,
                })
            }
        }

        let cflag = true
        switch (marketName) {
            case "Match Odds":
                inplay = m.inplay
                matchoddmarketid = m.marketId
                if (oddsstatus == "") {
                    betstatus = false
                }
                cflag = false
                if (m.marketStartTime !== "" && limits['setbetaccepingtime'] && limits['setbetaccepingtime']['matchodd']) {
                    let add = 0
                    if (limits['setbetaccepingtime']['matchodd']['isChecked']) {
                        add = 0
                    } else {
                        add = (Number(limits['setbetaccepingtime']['matchodd']['matchtime']) * 60 * 1000)
                    }
                    let marketStartTime = new Date(m.marketStartTime)
                    let current = new Date(new Date().valueOf() + add)
                    if (marketStartTime < current) {
                        betstatus = true
                    } else {
                        betstatus = false
                    }

                }

                markets[marketName] = {}
                if (odds.length) {
                    // if (odds[0].inplay) {
                    //     inplay = true
                    // }
                    oddsstatus = odds[0].status
                    let oddsrunners = odds[0].runners
                    for (let j in m.runners) {
                        let run = m.runners[j]
                        let odd = oddsrunners.find(obj => obj.selectionId.toString() == run.selectionId.toString())
                        if (odd) {

                            if (j == 0) {
                                hda.h = {
                                    status: odd.status,
                                    totalMatched: odd.totalMatched,
                                    back: getMaxLayback(odd.ex.availableToBack),
                                    lay: getMaxLayback(odd.ex.availableToLay)
                                }
                            } else if (j == 1) {
                                hda.a = {
                                    status: odd.status,
                                    totalMatched: odd.totalMatched,
                                    back: getMaxLayback(odd.ex.availableToBack),
                                    lay: getMaxLayback(odd.ex.availableToLay)
                                }
                            } else if (j == 2) {
                                hda.d = {
                                    status: odd.status,
                                    totalMatched: odd.totalMatched,
                                    back: getMaxLayback(odd.ex.availableToBack),
                                    lay: getMaxLayback(odd.ex.availableToLay)
                                }
                            }
                        } else {

                        }
                    }
                }
                markets[marketName] = {
                    marketId: m.marketId,
                    marketStartTime: m.marketStartTime,
                    oddsstatus,
                    betstatus,
                    totalMatched: m.totalMatched,
                    marketName,
                    odds: oddsitems,
                    result: m.result
                }
                break;
            case "Bookmaker":
                bookmaker = m
                break;
            default:
                if (m.marketStartTime !== "" && limits['setbetaccepingtime'] && limits['setbetaccepingtime']['matchodd']) {
                    let add = 0
                    if (limits['setbetaccepingtime']['matchodd']['isChecked']) {
                        add = 0
                    } else {
                        add = (Number(limits['setbetaccepingtime']['matchodd']['matchtime']) * 60 * 1000)
                    }
                    let marketStartTime = new Date(m.marketStartTime)
                    let current = new Date(new Date().valueOf() + add)
                    if (marketStartTime < current) {
                        betstatus = true
                    } else {
                        betstatus = false
                    }

                }
                markets["other"] = []
                markets["other"].push(
                    {
                        marketId: m.marketId,
                        marketStartTime: m.marketStartTime,
                        oddsstatus,
                        betstatus,
                        totalMatched: m.totalMatched,
                        marketName,
                        odds: oddsitems,
                         result: m.result
                    }
                )
                break;
        }

        if (cflag) {
            continue;
        }
        if (!markets['Match Odds']) {
            continue;
        }
        if (fancys.length) {
            if (m.marketStartTime !== "" && limits['setbetaccepingtime'] && limits['setbetaccepingtime']['fancy']) {
                let add = 0
                if (limits['setbetaccepingtime']['fancy']['isChecked']) {
                    add = 0
                } else {
                    add = (Number(limits['setbetaccepingtime']['fancy']['matchtime']) * 60 * 1000)
                }
                let marketStartTime = new Date(m.marketStartTime)
                let current = new Date(new Date().valueOf() + add)
                if (marketStartTime < current) {
                    betstatus = true
                } else {
                    betstatus = false
                }
            }

            if (!markets["fancys"]) {
                markets["fancys"] = []
            }
            markets["fancys"].push({
                marketId: m.marketId,
                marketStartTime: m.marketStartTime,
                oddsstatus,
                betstatus,
                totalMatched: m.totalMatched,
                marketName,
                odds: fancys,
                limits: limits['setfancy'],
                result: m.result
            })
            fc += fancys.length
        }
    }

     if (bookmaker)  {

         markets["Bookmaker"] = {
            marketId: bookmaker.marketId,
            marketStartTime: bookmaker.marketStartTime,
            oddsstatus: bookmaker.oddsstatus,
            betstatus: markets['Match Odds'] ? markets['Match Odds'].betstatus : false,
            marketName: bookmaker.marketName,
            odds: bookmaker.runners,
            limits: limits['setBookmarker'],
            result: bookmaker.result
        }
        bc++
    }

    return ({ markets, inplay, hda, bc, fc,matchoddmarketid })
}

function arrayMinordersort(array) {
    let news = array.sort(function (c, b) {
        return c.price - b.price
    })
    return news
}

function arrayMaxordersort(array) {
    let news = array.sort(function (c, b) {
        return b.price - c.price
    })
    return news
}

async function admingetfanys(marketid) {

    let odd = await betfairfancylist.find({ marketId: marketid })

    let rows = []
    for (let i in odd) {
        rows.push(odd[i]._doc)
    }
    if (odd.length) {
    }
    return rows
}

function getMaxLayback(array) {
    array.sort(function (c, b) {
        return b.price - c.price
    })
    return array[0]
}

exports.playergetmarketslist = async (req, res, next) => {
    let rq = req.body.row
    if (rq) {
        if (rq.eventType === "000") {
            
            let items = [];
            // inplayredisClient.keys("*", async (err, keys) => {
            //     inplayredisClient.mget(keys, async function (err, values) {
            //         if (values) {
            //             for (let i in values) {
            //                 let item = JSON.parse(values[i]);
            //                 items.push(item)
            //             }
            //             res.send({
            //                 status: true,
            //                 data: items
            //             })
            //             return next()
            //         } else {
            //             res.send({ status: false, })
            //         return next()
            //         }
            //     })
            //  })
            redisClient.keys("*", async (err, keys) => {
                redisClient.mget(keys, async function (err, values) {
                    if (values) {
                        for (let i in values) {
                            let item = JSON.parse(values[i]);
                            items.push(item)
                        }
                        
                        // items


                        for (let i in items) {
                            for (let j in items[i].Serlist) {
                                let matches = []
                                for (let k in items[i].Serlist[j].matches) {
                                    let inplay = items[i].Serlist[j].matches[k].inplay
                                    if (inplay) {
                                        matches.push(items[i].Serlist[j].matches[k])
                                    }
                                }

                                if (matches.length) {
                                    items[i].Serlist[j].matches = matches
                                } else {
                                    items[i].Serlist[j].matches = []
                                }
                            }
                        }

                        res.send({
                            status: true,
                            data: items
                        })
                        return next()
                    } else {
                        res.send({ status: false, })
                    return next()
                    }
                })
             })

            
            
        } else {
            redisClient.keys(`${rq.eventType}`, async (err, keys) => {
                if (keys.length) {
                    redisClient.get(keys[0], async function (err, values) {
                        if (values) {
                            let event = JSON.parse(values);
                            res.send({
                                status: true,
                                data: [event]
                            })
                            return next()
                        }
                    })
                } else {
                    res.send({ status: false, })
                    return next()
                }
            })
            // let item = SPORTSLIST.find(obj=> obj.sport.eventType == rq.eventType)
            // if (item) {
            // } else {
            // }
        }
    } else {
        res.send({ status: false, })
        return next()
    }
}

exports.SportImgageFileupload = async (req, res, next) => {
    let rowid = req.body._id
    let imgsrc = req.body.imagesrc
    if (imgsrc) {
        let d = await BaseControl.BfindOneAndUpdate(betfairSportslist, { _id: rowid }, { image: imgsrc })
        if (d) {
            this.getSportsList(req, res, next)
        } else {
            res.send({ status: false, })
            return next()
        }
    } else {
        res.send({ status: false, })
        return next()
    }
}

exports.admingetopenbets = async (req, res, next) => {
    let userid = req.user._id
    let matchoddbets = await betfairbettinghistory.find({ matchId: req.body.matchid, matchodd: true }).populate("userid")
    let d = await betfairbettinghistory.aggregate([{
        $match: {
            matchId: req.body.matchid,
            isfancy: false
        }
    },
    {
        $group: {
            "_id": {
                matchId: "$matchId",
                marketId: "$marketId",
                userid: "$userid",
            },
            bets: {
                $push: {
                    "SELECTION": "$oddName",
                    "ODD": "$price",
                    "marketName": "$marketName",
                    "backlay": "$backlay",
                    "profit": "$profit",
                    "stake": "$stake",
                    "DATE": "$DATE",
                    "matchId": "$matchId",
                    "marketId": "$marketId",
                    "isfancy": "$isfancy",
                    "matchodd": "$matchodd",
                    "bookmaker": "$bookmaker",
                    "selectionId": "$selectionId",
                    "betLoss": "$betLoss",
                    "price": "$price",
                }
            }
        }
    },
    {
        "$lookup": {
            "from": "user_users",
            "localField": "_id.userid",
            "foreignField": "_id",
            "as": "user"
        }
    },
    {
        $unwind: "$user"
    }
    ])
    res.send({
        status: true,
        data: matchoddbets,
        currents: d
    })
    return next()

}

exports.admingetfancybets = async (req, res, next) => {
    // let userid = req.user._id
    let matchoddbets = await betfairbettinghistory.find({ matchId: req.body.matchid, isfancy: true }).populate("userid")

    res.send({
        status: true,
        data: matchoddbets
    })
    return next()

}

exports.admingetbookmakerbets = async (req, res, next) => {
    let matchoddbets = await betfairbettinghistory.find({ matchId: req.body.matchid, bookmaker: true }).populate("userid")

    res.send({
        status: true,
        data: matchoddbets
    })
    return next()
}

exports.playergetopenbets = async (req, res, next) => {
    let userid = req.user._id

    // let openbets = await betfairbettinghistory.find({  },"")
    let openbets = await betfairbettinghistory.aggregate([{
        $match: {
            $and: [{
                userid: mongoose.Types.ObjectId(userid),
                // marketName: "bet",
                matchId: req.body.matchid
            }]
        }
    },
    {
        $project: {
            "SELECTION": "$oddName",
            "ODD": "$price",
            "marketName": "$marketName",
            "backlay": "$backlay",
            "profit": "$profit",
            "stake": "$stake",
            "DATE": "$DATE",
            "matchId": "$matchId",
            "marketId": "$marketId",
            "isfancy": "$isfancy",
            "matchodd": "$matchodd",
            "bookmaker": "$bookmaker",
            "selectionId": "$selectionId",
            "betLoss": "$betLoss",
            "price": "$price",
        }
    }
    ])
    if (openbets && openbets.length) {
        res.send({
            status: true,
            data: openbets
        })
        return next()
    } else {
        res.send({
            status: false,
            data: ""
        })
        return next()
    }
}

exports.SportImgFileupload = async (req, res, next) => {
    let rowid = req.body._id
    let imgsrc = req.body.imagesrc
    if (imgsrc) {
        let d = await BaseControl.BfindOneAndUpdate(betfairSportslist, { _id: rowid }, { icon: imgsrc })
        if (d) {
            this.getSportsList(req, res, next)
        } else {
            res.send({ status: false, })
            return next()
        }
    } else {
        res.send({ status: false, })
        return next()
    }
}

exports.updateSportlist = async (req, res, next) => {
    let row = req.body.row
    if (row) {
        let d = await BaseControl.BfindOneAndUpdate(betfairSportslist, { _id: row._id }, row)
        if (d) {
            this.getSportsList(req, res, next)
        } else {
            res.send({ status: false, })
            return next()
        }
    } else {
        res.send({ status: false, })
        return next()
    }
}

exports.orderupdateSportlist = async (req, res, next) => {
    var indata = req.body.row;
    if (indata) {
        for (var i = 0; i < indata.length; i++) {
            var updatehandle = await BaseControl.BfindOneAndUpdate(betfairSportslist, { _id: indata[i]._id }, indata[i]);
            if (!updatehandle) {
                res.json({ status: false, data: "fail" });
                return next();
            }
        }
        this.getSportsList(req, res, next)
    } else {
        res.json({ status: false, data: "fail" });
        return next();
    }
}

exports.allowgetSportsList = async (req, res, next) => {
    let rdata = await betfairSportslist.aggregate([{
        $match: {
            $and: [{
                status: true
            }]
        }
    },
    {
        $sort: {
            order: 1
        }
    },
    {
        "$lookup": {
            "from": "betfairbetminmaxes",
            "localField": "_id",
            "foreignField": "betfairSportslistid",
            "as": "minmaxvalue"
        }
    },
    { "$unwind": "$minmaxvalue" },

    ])
    if (rdata) {
        res.send({ status: true, data: rdata })
        return next()
    } else {
        res.send({ status: false, })
        return next()
    }
}

exports.getSerieslist = async (req, res, next) => {
    let { sport_id } = req.body
    let data = await betfairseriesList.find({ sportid: sport_id, status: true })
    res.send({ status: true, data: data })
    return next()
}

exports.getMatchesList = async (req, res, next) => {
    let { series_id } = req.body
    let data = await betfairmatchlist.find({ competitionid: series_id, status: true })
    let array = []
    for (let i in data) {

        let d = await betfairmarketlist.findOne({marketName: "Match Odds",match_id: data[i].event.id}) 
        if (d) {
            array.push({ ...data[i]._doc,inplay: d._doc.inplay })
        }
    }
    res.send({ status: true, data: array })
    return next()
}

exports.getMatketsList = async (req, res, next) => {
    let { match_id } = req.body

    let data = await betfairmarketlist.find({ match_id: match_id })
    res.send({ status: true, data: data })
    return next()
}

exports.getFancyList = async (req, res, next) => {
    let { match_id } = req.body

    let data = await betfairfancylist.find({ match_id: match_id })
    if (data) {
        res.send({ status: true, data: data })
        return next()
    } else {
        res.send({
            status: false,
            data: "error"
        })
        return next()
    }
}

exports.updateSerieslist = async (req, res, next) => {
    let { sport_id, series_id, status } = req.body

    let d = await betfairseriesList.findOneAndUpdate({ sportid: sport_id, "competition.id": series_id }, { status: status })
    if (d) {
        Realtimesportlist()
        this.getSerieslist(req, res, next)
    } else {
        res.send({
            status: false,
            data: "fail"
        })
        return next()
    }
}

exports.updateInplaylist = async (req, res, next) => {
    let { match_id, series_id, status } = req.body

    let d = await betfairmarketlist.findOneAndUpdate({ "match_id": match_id, marketName: "Match Odds" }, { inplay: status })
    if (d) {
        Realtimesportlist()
        this.getMatchesList(req, res, next)
    } else {
        res.send({
            status: false,
            data: "fail"
        })
        return next()
    }
}

exports.updateMatchlist = async (req, res, next) => {
    let { match_id, series_id, status } = req.body

    let d = await betfairmatchlist.findOneAndUpdate({ "event.id": match_id, "competitionid": series_id }, { status: status })
    if (d) {
        Realtimesportlist()
        this.getMatchesList(req, res, next)
    } else {
        res.send({
            status: false,
            data: "fail"
        })
        return next()
    }
}

exports.updaetMatketsList = async (req, res, next) => {
    let { marketid, match_id, status } = req.body

    let d = await betfairmarketlist.findOneAndUpdate({ "match_id": match_id, "marketId": marketid }, { status: status })
    if (d) {
        Realtimesportlist()
        this.getMatketsList(req, res, next)
    } else {
        res.send({
            status: false,
            data: "fail"
        })
        return next()
    }
}

exports.updateFancyslist = async (req, res, next) => {
    let { SelectionId, match_id, status } = req.body

    let u = await betfairfancylist.findOneAndUpdate({ match_id: match_id, SelectionId: SelectionId }, { display: status })
    if (u) {
        Realtimesportlist()
        this.getFancyList(req, res, next)
    } else {
        res.send({
            status: false,
            data: "Error"
        })
        return next()
    }
}

exports.betsetminmaxvalueget = async (req, res, next) => {

    let rdata = await betfairSportslist.aggregate([{
        $match: {
            $and: [{
                status: true
            }]
        }
    },
    {
        "$lookup": {
            "from": "betfairbetminmaxes",
            "localField": "_id",
            "foreignField": "betfairSportslistid",
            "as": "minmaxvalue"
        }
    },
    { "$unwind": "$minmaxvalue" },
    {
        $project: {
            sportid: "$_id",
            max: "$minmaxvalue.maxvalue",
            min: "$minmaxvalue.minvalue"
        }
    }
    ])
    let row = {}
    for (let i in rdata) {
        row[rdata[i].sportid] = {}
        row[rdata[i].sportid] = {
            minvalue: rdata[i].min,
            maxvalue: rdata[i].max
        }
    }
    let d = await betfairSportslist.find({ status: true })
    res.send({
        status: true,
        data: row,
        slist: d
    })
}

exports.betsetminmaxvaluesave = async (req, res, next) => {
    let rows = req.body.data
    if (rows) {
        for (let i in rows) {
            let row = {
                betfairSportslistid: mongoose.Types.ObjectId(i),
                minvalue: rows[i].minvalue,
                maxvalue: rows[i].maxvalue,
            }
            let d = await BaseControl.BfindOneAndUpdate(betfairBetminmax, { betfairSportslistid: row.betfairSportslistid }, row)
        }
        this.betsetminmaxvalueget(req, res, next)
    } else {
        res.send({
            status: false,
            data: "fail"
        })
    }
}

exports.validateOdds = (bets, odd) => {

    // var min = Math.min.apply(null, persons.map(function(a){return a.Age;}))
    // var max = Math.max.apply(null, persons.map(function(a){return a.Age;}))
    // Hedging / Arbitration : Betslip : if A bet is accepted on Back on odds 1.2 , Lay odds should always be more than 1.2 if player wants to bet on Lay on same team  or Back on Team b 
    // Betslip if a player bets on Lay on odds 1.2 Back odds should always be less in Team A Back and Team B Lay 

    //backlay
    if (bets.length) {

        if (odd.backlay === "back") {
            let lays = bets.filter(obj => obj.backlay === "lay")
            if (lays.length) {
                var minlayodd = Math.min.apply(null, lays.map(function (a) { return a.price; }))
                if (minlayodd > odd.price) {
                    return true
                } else {
                    return false
                }
            } else {
                return true
            }
        } else {
            let backs = bets.filter(obj => obj.backlay === "back")
            if (backs.length) {
                var maxbackodd = Math.max.apply(null, backs.map(function (a) { return a.price; }))
                if (maxbackodd < odd.price) {
                    return true
                } else {
                    return false
                }
            } else {
                return true
            }
        }
    } else {
        return true
    }
}

exports.getProfitLoose = (stake, oddprice, odd) => {
    let betProfit = 0
    let betLoss = 0
    if (odd.bookmaker) {
        // if (odd.backlay === "back") {
        //     betProfit = Math.round((stake/100) * oddprice);
        //     betLoss = stake;
        // } else {
        //     betProfit = stake;
        //     betLoss = Math.round((stake/100) * oddprice);
        // }
        if (odd.backlay === "back") {
            betProfit = stake * (oddprice - 1);
            betLoss = stake;
        } else {
            betProfit = stake;
            betLoss = stake * (oddprice - 1);
        }
    } else if (odd.isfancy) {
        if (odd.backlay === "back") {
            betProfit = ((stake * oddprice) / 100);
            betLoss = stake;
        } else {
            betProfit = stake;
            betLoss = ((stake * oddprice) / 100);
        }
    } else {
        if (odd.backlay === "back") {
            betProfit = stake * (oddprice - 1);
            betLoss = stake;
        } else {
            betProfit = stake;
            betLoss = stake * (oddprice - 1);
        }
    }
    return {
        profit: Number(betProfit).toFixed(0),
        betLoss: Number(betLoss).toFixed(0)
    }
}

exports.playerplacebets = async (req, res, next) => {
    let { row } = req.body


    var playeritem = await BaseControl.playerFindbyEmailUpdate(req.user.email); // balance sort
    if (row && playeritem) {
        let fisttime = new Date().valueOf()
        let useragent = req.useragent
        let betdelaytime = await BaseControl.getbetdeplaytime()
        let oddsStatus = null
        setTimeout(async () => {

            let p_item = await BaseControl.BfindOne(GamePlay, { id: req.user._id });
            let user = req.user
            let userid = req.user._id
            row['userid'] = mongoose.Types.ObjectId(userid)
            row['sportid'] = mongoose.Types.ObjectId(row.sportid)
            row['status'] = "BET"
            row['transactionId'] = new Date().valueOf()
            row['ipaddress'] = BaseControl.get_ipaddress(req)
            row['deviceinfor'] = {
                browser: useragent.browser,
                os: useragent.os,
                version: useragent.version,
                platform: useragent.platform,
                devicename: useragent.isDesktop ? "Desktop" : useragent.isMobile ? "Mobile" : useragent.isTablet ? "Tablet" : useragent.isiPhone ? "iPhone" : "Desktop"
            }
            row["DATE"] = BaseControl.IndiatimeFromTime(new Date())

            let bets = await BaseControl.Bfind(betfairbettinghistory, {
                matchId: row.matchId,
                marketId: row.marketId,
                userid: row.userid,
                isSettled: false
            })

            let market = await this.IsMarketAvailable(row.matchId, row.marketId);
            if (!market && market.status) {
                return res.json({ status: false, data: "This market is unavailable" })
            }

            if (row.bookmaker) {
                oddsStatus = market.runners
                let oitem = oddsStatus.find(obj=> obj.selectionId == row.selectionId)
                if (!oitem || oitem.status != "ACTIVE")  {
                    return res.json({ status: false, data: "This odd ended." })
                }
            } else {
                oddsStatus = await this.IsOddsAvailable(row.matchId, row.marketId);
                if (!oddsStatus) {
                    return res.json({ status: false, data: "This odd ended." })
                }
            }

            // let betsarray = await BaseControl.Bfind(betfairbettinghistory, {
            //     matchId: row.matchId,
            //     marketId: row.marketId,
            //     userid: row.userid,
            //     selectionId: row.selectionId,
            //     isSettled: false
            // })

            // /// validate lay odd and back odd 
            // let check = this.validateOdds(betsarray, row)
            // if (!check) {
            //     res.send({ status: false, data: "Please enter valid odd." })
            //     return next()
            // }

            let wallets_ = {
                commission: 0,
                status: "BET",
                roundid: row.transactionId,
                transactionid: row.transactionId,
                userid: mongoose.Types.ObjectId(userid),
                credited: 0,
                lastbalance: p_item.balance,
                exchangedata: {
                    marketName: row.marketName,
                    matchName: row.matchName,
                    price: row.price,
                    oddName: row.oddName,
                    backlay: row.backlay,
                    isfancy: row.isfancy,
                    fanytarget: row.fanytarget
                },
                ipaddress: BaseControl.get_ipaddress(req)
            }

            let d = false;

            let oitem = oddsStatus.find(obj => obj.selectionId === row.selectionId)
            if (oitem && oitem.ex) {
                let items = []
                if (row.backlay == "lay") {
                    items = oitem.ex.availableToLay
                } else {
                    items = oitem.ex.availableToBack
                }

                let news = items.sort(function (b, c) {
                    return Number(b.price) - Number(c.price)
                })
                if (news[row.oddindex]) {
                    row.price = news[row.oddindex].price
                }
            }
            

            let PFL = this.getProfitLoose(row.stake, row.price, row)
            row.profit =  PFL.profit
            row.betLoss = PFL.betLoss

            let newExposure1 = await this.getExchangeExposure(row, [...bets,...[row]], row.bookmaker);
            row.exposure = newExposure1

            if (row.isfancy) {

                if (playeritem.balance < row.betLoss) {
                    return res.json({ status: false, data: "Your balance is no enough" })
                }
                wallets_.debited = row.betLoss;
                d = await BaseControl.email_balanceupdate(user.email, -1 * row.betLoss, wallets_);
            } else {
                let currentExposure = await this.getExchangeExposure(row, bets, row.bookmaker);
                if (currentExposure === false) {
                    return res.json({ status: false, data: "Match Error" })
                }
                let newExposure = row.exposure
                let nextBalance = playeritem.balance + Math.abs(currentExposure) + newExposure
                if (nextBalance < 0) {
                    return res.json({ status: false, data: "Your balance is no enough" })
                }
                let updateBalance = Math.abs(currentExposure) + newExposure
                wallets_.debited = Math.abs(updateBalance);
                d = await BaseControl.email_balanceupdate(user.email, updateBalance, wallets_);
            }

            if (d && d !== false) {

                row['lastbalance'] = playeritem.balance
                row['updatedbalance'] = d
                let sh = await BaseControl.data_save(row, betfairbettinghistory)

                if (sh) {
                    res.send({ status: true, data: d })
                    return next()
                } else {
                    res.send({ status: false, data: "error" })
                    return next()
                }
            } else {
                res.send({ status: false, data: "error" })
                return next()
            }
        }, betdelaytime);

    } else {
        res.send({ status: false, data: "Please provide valid data." })
        return next()
    }
}

exports.IsOddsAvailable = async (eventId, marketId) => {

    let odd = await getoddsAPI( marketId)
    if (odd && odd.status === "OPEN") {
        return odd.runners
    } else {
        return false
    }
}

exports.IsMarketAvailable = async (eventId, marketId) => {

    let d = await betfairmarketlist.findOne({ match_id: eventId, marketId: marketId })
    if (d) {
        return d
    } else {
        return false
    }

}

exports.getExchangeExposure = async (betItem, bets, bookmaker) => {

    let runners = []
    runners = await getExchangeBetOdds(betItem.matchId, betItem.marketId)
    if (!runners) {
        return false;
    }

    let drawselectionid = ""
    let AteamSelectionid = ""
    let BteamSelectionid = ""
    if (runners.length === 3) {
        AteamSelectionid = runners[0].selectionId
        BteamSelectionid = runners[1].selectionId
        drawselectionid = runners[2].selectionId
    } else if (runners.length === 2) {
        AteamSelectionid = runners[0].selectionId
        BteamSelectionid = runners[1].selectionId
    } else {
        return {}
    }

    let Ateam = []
    let Bteam = []
    let Dteam = []
    let PNL = {
        [drawselectionid]: 0,
        [AteamSelectionid]: 0,
        [BteamSelectionid]: 0
    }

    for (let i in bets) {
        // if (bets[i].marketName === "Match Odds") {
        switch (bets[i].selectionId.toString()) {
            case AteamSelectionid.toString():
                Ateam.push(bets[i])
                break;
            case BteamSelectionid.toString():
                Bteam.push(bets[i])
                break;
            default:
                Dteam.push(bets[i])
                break;
        }
        // }
    }

    for (let i in Dteam) {
        if (Dteam[i].backlay === "back") {
            PNL[drawselectionid] += Number(Dteam[i].profit)
        } else {
            PNL[drawselectionid] -= Number(Dteam[i].betLoss)
        }

    }

    for (let i in Ateam) {
        if (Ateam[i].backlay === "back") {
            PNL[AteamSelectionid] += Number(Ateam[i].profit)
        } else {
            PNL[AteamSelectionid] -= Number(Ateam[i].betLoss)
        }
    }

    for (let i in Bteam) {
        if (Bteam[i].backlay === "back") {
            PNL[BteamSelectionid] += Number(Bteam[i].profit)
        } else {
            PNL[BteamSelectionid] -= Number(Bteam[i].betLoss)
        }
    }


    let darray = getRemainarray(Ateam)
    for (let i in darray) {
        if (darray[i].backlay === "back") {
            PNL[BteamSelectionid] -= Number(darray[i].stake)
            PNL[drawselectionid] -= Number(darray[i].stake)
        } else {
            PNL[BteamSelectionid] += Number(darray[i].stake)
            PNL[drawselectionid] += Number(darray[i].stake)
        }
    }


    darray = getRemainarray(Bteam)

    for (let i in darray) {
        if (darray[i].backlay === "back") {
            PNL[AteamSelectionid] -= Number(darray[i].stake)
            PNL[drawselectionid] -= Number(darray[i].stake)
        } else {
            PNL[drawselectionid] += Number(darray[i].stake)
            PNL[AteamSelectionid] += Number(darray[i].stake)
        }
    }

    darray = getRemainarray(Dteam)

    for (let i in darray) {
        if (darray[i].backlay === "back") {
            PNL[BteamSelectionid] -= Number(darray[i].stake)
            PNL[AteamSelectionid] -= Number(darray[i].stake)
        } else {
            PNL[BteamSelectionid] += Number(darray[i].stake)
            PNL[AteamSelectionid] += Number(darray[i].stake)
        }
    }

    let exposureAmount = 0;
    for (let i in PNL) {
        if (exposureAmount > PNL[i]) {
            exposureAmount = PNL[i]
        }
    }
    return exposureAmount

    function getRemainarray(teams) {
        let array = JSON.parse(JSON.stringify(teams));
        for (let i = 0; i < array.length; i++) {
            for (let j = i + 1; j < array.length; j++) {
                if (array[i].stake === array[j].stake && ((array[i].backlay === 'lay' && array[j].backlay === 'back') || (array[i].backlay === 'back' && array[j].backlay === 'lay'))) {
                    array.splice(i, 1);
                    array.splice(j - 1, 1);
                    j = j - 1;
                    break;
                }
            }
        }
        return array
    }
}

const getExchangeBetOdds = async (matchId, marketId) => {

    let markets = await betfairmarketlist.findOne({ match_id: matchId, marketId: marketId })
    if (markets) {
        return markets.runners
    } else {
        return false
    }

}

exports.getTotalExchangeExposure = async (userid) => {

    // this is for matchodd, bookmaker, other market
    let markets = await betfairbettinghistory.aggregate([{
        $match: {
            $and: [{
                userid,
                matchodd: true,
                isSettled: false,
                isCancel: false
            }]
        }
    },
    {
        $group: {
            _id: {
                matchId: "$matchId",
                marketId: "$marketId",
            },
            bets: {
                $push: {
                    "price": "$price",
                    "betLoss": "$betLoss",
                    "backlay": "$backlay",
                    "profit": "$profit",
                    "stake": "$stake",
                    "selectionId": "$selectionId"
                }
            }
        }
    }
    ])
    let totalExposure = 0;
    for (let i in markets) {
        // let bets = await BaseControl.Bfind(betfairbettinghistory, {
        //     matchId: markets[i]._id.matchId,
        //     marketId: markets[i]._id.marketId,
        //     userid: userid,
        //     isSettled: false,
        //     matchodd: true
        // })
        let bets = markets[i]['bets']

        let smallExposure = await this.getExchangeExposure({
            matchId: markets[i]._id.matchId,
            marketId: markets[i]._id.marketId,
            userid
        }, bets)
        totalExposure += smallExposure
    }

    // this is for , bookmaker
    let bookhis = await betfairbettinghistory.aggregate([{
        $match: {
            $and: [{
                userid,
                bookmaker: true,
                isSettled: false,
                isCancel: false
            }]
        }
    },
    {
        $group: {
            _id: {
                matchId: "$matchId",
                marketId: "$marketId",
            },
            bets: {
                $push: {
                    "price": "$price",
                    "betLoss": "$betLoss",
                    "backlay": "$backlay",
                    "profit": "$profit",
                    "stake": "$stake",
                    "selectionId": "$selectionId"
                }
            }
        }
    }
    ])
    // let totalExposure = 0;
    for (let i in bookhis) {
        let bets = await BaseControl.Bfind(betfairbettinghistory, {
            matchId: bookhis[i]._id.matchId,
            marketId: bookhis[i]._id.marketId,
            userid: userid,
            isSettled: false
        })
        // let bets = markets[i]['bets']


        let smallExposure = await this.getExchangeExposure({
            matchId: bookhis[i]._id.matchId,
            marketId: bookhis[i]._id.marketId,
            userid
        }, bets, true)
        totalExposure += smallExposure
    }

    // this is for fancy
    let bets = await BaseControl.Bfind(betfairbettinghistory, {
        userid: userid,
        isSettled: false,
        isfancy: true,
        isCancel: false
    })
    for (let i in bets) {
        totalExposure -= Number(bets[i].stake)
    }

    return totalExposure
}

exports.fancybetminmaxset = async (req, res, next) => {
    let row = req.body.row
    if (row) {
        let s = await BaseControl.BfindOneAndUpdate(betfairSetting, { key: row.key }, row)
        if (s) {
            res.send({
                status: true,
                data: s
            })
            return next()
        } else {
            res.send({
                status: false,
                data: "fail"
            })
            return next()
        }
    } else {
        res.send({
            status: false,
            data: "fail"
        })
        return next()
    }
}

exports.fancybetminmaxget = async (req, res, next) => {
    let key = req.body.row
    if (key) {

        let d = await BaseControl.BfindOne(betfairSetting, { key: key })
        if (d) {
            res.send({
                status: true,
                data: d
            })
            return next()

        } else {
            res.send({
                status: false,
                data: "fail"
            })
            return next()
        }
    } else {
        res.send({
            status: false,
            data: "fail"
        })
        return next()
    }
}

exports.getactivematches = async (req, res, next) => {
    let sportslist = []
    let row = req.body.activeSport
    if (row) {
        sportslist = await betfairSportslist.find({ status: true, eventType: row.eventType }, "eventType name marketCount");
    } else {
        sportslist = await betfairSportslist.find({ status: true }, "eventType name marketCount");
    }
    let items = []
    for (let i in sportslist) {
        let d = await getSerlist(sportslist[i].eventType, sportslist[i]._doc)
        items = [...items, ...d]
    }
    res.send({
        status: true,
        data: items
    })
    return next()


    async function getSerlist(sport_id, sport) {
        let data = await betfairseriesList.find({ sportid: sport_id, status: true })
        let rows = []
        for (let i in data) {
            let p = await getmatchs(data[i], sport)
            if (p.length) {
                rows = [...rows, ...p]
            }
        }
        return rows

    }

    async function getmatchs(competitions, sport) {

        let series_id = competitions.competition.id
        let values = await betfairmatchlist.find({ competitionid: series_id, status: true })
        let matches = []
        for (let i in values) {
            let bookmarker = await getmarkets(values[i])
            matches.push({ ...values[i]._doc, series_id, ...sport, bookmarker })
        }
        return matches

    }

    async function getmarkets(match) {

        let match_id = match.event.id
       let values = await betfairmarketlist.findOne({ match_id: match_id,marketName:"Bookmaker", status: true })
        if (values) {
            return true
        } else {
            return false
        }

    }

}

exports.updatematches = async (req, res, next) => {
    let row = req.body.row
    if (row) {
        let match_id = row.event.id
        let { series_id, bookmarkerstatus } = row

        let rdata = await betfairmatchlist.findOneAndUpdate({ competitionid: series_id, "event.id": match_id }, { bookmarkerstatus: bookmarkerstatus })
        if (rdata) {
            this.getactivematches(req, res, next)
        } else {
            res.send({
                status: false,
                data: "error"
            })
            return next()
        }

    } else {
        res.send({
            status: false,
            data: "error"
        })
        return next()
    }
}

exports.setBettingStatusupdatematches = async (req, res, next) => {
    let row = req.body.row
    if (row) {
        let match_id = row.event.id
        let { competitionid } = row
        // betfairMatchesList.set(`${series_id}_${match_id}`, JSON.stringify(row))
        let d = await BaseControl.BfindOneAndUpdate(betfairmatchlist, { "event.id": match_id, competitionid: competitionid }, { matchoption: row.matchoption })
        if (d) {
            this.getactivematches(req, res, next)
        } else {
            res.send({
                status: false,
                data: "error"
            })
            return next()
        }
    } else {
        res.send({
            status: false,
            data: "error"
        })
        return next()
    }
}

exports.setminmaxupdatematches = async (req, res, next) => {
    let row = req.body.row
    if (row) {
        let match_id = row.event.id
        let { series_id } = row
        let d = await BaseControl.BfindOneAndUpdate(betfairmatchlist, { "event.id": match_id, competitionid: series_id }, { bettingamount: row.bettingamount })
        if (d) {
            this.getactivematches(req, res, next)
        } else {
            res.send({
                status: false,
                data: "error"
            })
            return next()
        }
    } else {
        res.send({
            status: false,
            data: "error"
        })
        return next()
    }
}

exports.getBetshistoryload = async (req, res, next) => {


    //     matchName: 'Surrey v Somerset',
    //     matchTime: 'Thu Aug 05 2021 15:30:00 GMT+0530 (India Standard Time)',
    //     competitionName: 'Royal London One Day Cup',
    //     marketId: '1.186046622',
    //     selectionId: '424676',
    //     competitionid: '9961112',
    //     matchId: '30762058'
    //   },
    let date = req.body.date
    let params = req.body.parsedFilter
    let datap = req.body.params
    let start = BaseControl.get_stand_date_end(date.start);
    let end = BaseControl.get_stand_date_end(date.end);

    let count = await betfairbettinghistory.countDocuments({
        competitionid: datap.competitionid,
        matchId: datap.matchId,
        "DATE": {
            $gte: start,
            $lte: end
        }
    })

    let pages = ReportControl.setpage(params, count);

    let array = await betfairbettinghistory.find({
        competitionid: datap.competitionid,
        matchId: datap.matchId,
        "DATE": {
            $gte: start,
            $lte: end
        }
    }).populate("sportid").skip(pages.skip).limit(pages.params.perPage).populate("userid")
    let totoalwallet = {
        pnl: 0,
        "amount of bets": 0,
        "number of bets": 0
    }
    totoalwallet['number of bets'] = count
    let totalamounts = await betfairbettinghistory.aggregate([{
        $match: {
            competitionid: datap.competitionid,
            matchId: datap.matchId,
            "DATE": {
                $gte: start,
                $lte: end
            }
        }
    },
    {
        $group: {
            _id: null,
            amount: {
                $sum: "$stake"
            }
        }
    }
    ])

    if (totalamounts.length) {
        totoalwallet['amount of bets'] = totalamounts[0].amount
    }

    let win = await betfairbettinghistory.aggregate([{
        $match: {
            competitionid: datap.competitionid,
            matchId: datap.matchId,
            "DATE": {
                $gte: start,
                $lte: end
            }
        }
    },
    {
        $group: {
            "_id": "$status",
            winamount: {
                $sum: "$profit"
            },
            betamount: {
                $sum: "$stake"
            },
            count: {
                $sum: 1
            }
        },
    }
    ])
    let row = {
        "BET": 0,
        "WIN": 0
    }
    let betcount = 0
    if (win.length) {

        for (let i in win) {

            betcount += win[i].count
            if (win[i]._id === "WIN") {
                row['WIN'] = win[i].winamount
            } else {
                row['BET'] += win[i].betamount
            }
        }
    }
    let profit = parseInt(row.WIN - row.BET)

    totoalwallet.pnl = profit

    pages["skip2"] = (pages.skip) + array.length;
    res.send({
        status: true,
        data: array,
        pageset: pages,
        totoalwallet
    });
    return next();
}

exports.getdashboardmarketsadmin = async (req, res, next) => {
    let userid = req.user._id

    let date = req.body.date
    var start = BaseControl.get_stand_date_first(date.start);
    var end = BaseControl.get_stand_date_end(date.end);

    let totoalwallet = {
        "no Of matches": 0,
        "number of bets": 0,
        "amount of bets": 0,
        "pnl": 0
    }

    let matchesdata = await betfairbettinghistory.aggregate([{
        $match: {
            "DATE": {
                $gte: start,
                $lte: end
            }
        }
    },
    {
        $group: {
            _id: {
                sportid: "$sportid",
                competitionid: "$competitionid",
                matchId: "$matchId"
            },
        }
    }
    ])
    totoalwallet['no Of matches'] = matchesdata.length

    let betsacount = await betfairbettinghistory.countDocuments({ "DATE": { $gte: start, $lte: end } })

    totoalwallet['number of bets'] = betsacount

    let totalamounts = await betfairbettinghistory.aggregate([{
        $match: {
            "DATE": {
                $gte: start,
                $lte: end
            }
        }
    },
    {
        $group: {
            _id: null,
            amount: {
                $sum: "$stake"
            }
        }
    }
    ])

    if (totalamounts.length) {
        totoalwallet['amount of bets'] = totalamounts[0].amount
    }

    let win = await betfairbettinghistory.aggregate([{
        $match: {
            "DATE": {
                $gte: start,
                $lte: end
            }
        }
    },
    {
        $group: {
            "_id": "$status",
            winamount: {
                $sum: "$profit"
            },
            betamount: {
                $sum: "$stake"
            },
            count: {
                $sum: 1
            }
        },
    }
    ])
    let row = {
        "BET": 0,
        "WIN": 0
    }
    let betcount = 0
    if (win.length) {

        for (let i in win) {

            betcount += win[i].count
            if (win[i]._id === "WIN") {
                row['WIN'] = win[i].winamount
            } else {
                row['BET'] += win[i].betamount
            }
        }
    }
    let profit = parseInt(row.WIN - row.BET)

    totoalwallet.pnl = profit

    let ddd = await betfairbettinghistory.aggregate([{
        $match: {
            "DATE": {
                $gte: start,
                $lte: end
            }
        }
    },
    {
        $group: {
            _id: {
                sportid: "$sportid",
                competitionid: "$competitionid",
                matchId: "$matchId"
            },
            data: {
                $push: {
                    matchName: "$matchName",
                    matchTime: "$matchTime",
                    sportname: "$sportname",
                    competitionName: "$competitionName",
                    marketId: "$marketId",
                    selectionId: "$selectionId",
                    competitionid: "$competitionid",
                    matchId: "$matchId",
                }
            },
            betscount: {
                $sum: 1
            }
        }
    },

    ])
    let rows = []
    for (let i in ddd) {
        let plcount = await getplayercount(ddd[i]._id)
        rows.push(Object.assign({}, { data: ddd[i].data[0] }, { betscount: ddd[i].betscount }, { plcount }))
    }
    rows.sort(function (b, news) {
        return new Date(news.data.matchTime) - new Date(b.data.matchTime)
    })

    res.send({
        status: true,
        data: rows,
        totoalwallet
    })
    return next()

    async function getplayercount(ids) {
        let ddd = await betfairbettinghistory.aggregate([{
            $match: {
                sportid: ids.sportid,
                competitionid: ids.competitionid,
                matchId: ids.matchId,
                "DATE": {
                    $gte: start,
                    $lte: end
                }
            }
        },
        {
            $group: {
                _id: "$userid",
                count: {
                    $sum: 1
                }
            }
        }
        ])
        return ddd.length
    }
}

exports.getmymarketsadmin = async (req, res, next) => {

    let userid = req.user._id

    let row = req.body.date
    let start = BaseControl.get_stand_date_end(row.start);
    let end = BaseControl.get_stand_date_end(row.end);

    let ddd = await betfairbettinghistory.aggregate([{
        $match: {
            "DATE": {
                $gte: start,
                $lte: end
            }
        }
    },
    {
        $group: {
            _id: {
                sportid: "$sportid",
                competitionid: "$competitionid",
                matchId: "$matchId"
            },
            data: {
                $push: {
                    matchName: "$matchName",
                    matchTime: "$matchTime",
                    sportname: "$sportname",
                    competitionName: "$competitionName",
                    marketId: "$marketId",
                    selectionId: "$selectionId",
                    competitionid: "$competitionid",
                    matchId: "$matchId",
                }
            },
            betscount: {
                $sum: 1
            }
        }
    },

    ])
    let rows = []
    for (let i in ddd) {
        let plcount = await getplayercount(ddd[i]._id)
        rows.push(Object.assign({}, { data: ddd[i].data[0] }, { betscount: ddd[i].betscount }, { plcount }))
    }
    rows.sort(function (b, news) {
        return new Date(news.data.matchTime) - new Date(b.data.matchTime)
    })

    res.send({
        status: true,
        data: rows
    })
    return next()

    async function getplayercount(ids) {
        let ddd = await betfairbettinghistory.aggregate([{
            $match: {
                sportid: ids.sportid,
                competitionid: ids.competitionid,
                matchId: ids.matchId,
            }
        },
        {
            $group: {
                _id: "$userid",
                count: {
                    $sum: 1
                }
            }
        }
        ])
        return ddd.length
    }
}

async function getFancylimits() {
    let limits = {}
    let limitsetting = await betfairSetting.find({
        key: {
            $in: ["setBookmarker", "setfancy", "setbetaccepingtime"]
        }
    })

    for (let i in limitsetting) {
        limits[limitsetting[i].key] = limitsetting[i].value
    }
    return limits
}

exports.getMarketsById = async (req, res, next) => {

    let item = req.body.item
    let key = item.competitionid + "_" + item.matchId

    let matchitem = await betfairmatchlist.findOne({ competitionid: item.competitionid, "event.id": item.matchId })
    if (matchitem) {

        let limits = await getFancylimits()
        let markets = await getmarketsOld(matchitem._doc, limits)
        if (markets.markets && Object.keys(markets.markets).length) {
            matches = (Object.assign({}, matchitem._doc, markets))

            res.send({
                status: true,
                data: matches
            })
        } else {
            res.send({
                status: false,
                data: "matches"
            })
        }
    } else {
        res.send({
            status: false,
            data: "no db"
        })
    }
}

exports.getmymarketsplayer = async (req, res, next) => {
    let userid = req.user._id

    let ddd = await betfairbettinghistory.find({ userid: userid }).populate("sportid")
    let row = {}
    for (let i in ddd) {
        let bitem = ddd[i]
        let matchId = ddd[i].matchId
        if (row[matchId]) {
            row[matchId].betscount++
        } else {
            row[matchId] = {
                betscount: 1,
                matchName: bitem.matchName,
                matchTime: bitem.matchTime,
                sportname: bitem.sportid.name,
                competitionName: bitem.competitionName,
                marketId: bitem.marketId,
                selectionId: bitem.selectionId,
                competitionid: bitem.competitionid,
                matchId: bitem.matchId,
            }
        }
    }

    res.send({
        status: true,
        data: row
    })
    return next()
}

// fist page betexchange 
exports.betExchangefirstPage = async (req, res, next) => {
    
   
    redisClient.keys("*", async (err, keys) => {
        redisClient.mget(keys, async function (err, values) {
            if (values) {
                let frows = []
                for (let i in values) {
                    let sitem = JSON.parse(values[i]);
                    let items = sitem.Serlist;
                    let rows = []
                    for (let j in items) {
                        let itemk = items[j].matches
                        let row = []
                        for (let k in itemk) {
                            row.push(Object.assign({}, itemk[k], {
                                competition: {
                                    competition: items[j].competition,
                                    competitionRegion: items[j].competitionRegion,
                                    marketCount: items[j].marketCount
                                }
                            }, {
                                sport: sitem.sport
                            }))
                        }
                        rows = [...rows, ...row]

                    }
                    rows.sort(function (news, b) {
                        return new Date(news.event.openDate) - new Date(b.event.openDate)
                    })

                    frows.push(rows.slice(0, 1))
                    
                }
                res.send({
                    status: true,
                    data: frows
                })
            } else {
                res.send({
                    status: true,
                    data: []
                })
            }
        })
    })

}

exports.getExchangeBetHistory = async (req, res) => {


    let { parseFilter, condition, active } = req.body;
    let user = req.user
    let newCondition = null
    if (active == "1") {
        newCondition = {
            $and: [{
                userid: mongoose.Types.ObjectId(user._id),
                isSettled: false
            }]
        };
    } else {
        newCondition = {
            $and: [{
                userid: mongoose.Types.ObjectId(user._id),
                isSettled: true
            }]
        };
    }

    let count = await this.bGetCount(betfairbettinghistory, newCondition);
    let pages = await ReportControl.setpage(parseFilter, count);

    let dData = await betfairbettinghistory.find(newCondition)
        .populate("sportid")
        .limit(pages.limit)
        .skip(pages.skip)
    pages["skip1"] = dData.length ? pages.skip + 1 : 0;
    pages["skip2"] = (pages.skip) + dData.length;

    return res.json({
        status: true,
        data: {
            list: dData,
            pages
        }
    })
}

exports.bGetCount = async (model, condition = {}) => {

    let findhandle = null;
    await model.countDocuments(condition).then(rdata => {
        findhandle = rdata;
    });
    if (findhandle || findhandle === 0) {
        return findhandle;
    } else {
        return 0;
    }
   
}

exports.cancelExchangeBet = async (req, res) => {
    let { row, parseFilter, condition } = req.body;
    let ipaddress = BaseControl.get_ipaddress(req)

    let user = req.user
    let realRow = await BaseControl.BfindOne(betfairbettinghistory, { _id: row._id, isSettled: false })
    if (realRow) {
        let p_item = await BaseControl.BfindOne(GamePlay, { id: req.user._id });
        let wallets_ = {
            commission: 0,
            status: "BET",
            roundid: new Date().valueOf(),
            transactionid: new Date().valueOf(),
            userid: mongoose.Types.ObjectId(user._id),
            credited: realRow.stake,
            debited: 0,
            lastbalance: p_item.balance,
            exchangedata: {
                marketName: realRow.marketName,
                matchName: realRow.matchName,
                oddName: realRow.oddName
            },
            ipaddress
        }

        await BaseControl.BfindOneAndUpdate(betfairbettinghistory, { _id: row._id, isSettled: false }, { isSettled: true, status: "CANCEL" })
        await BaseControl.email_balanceupdate(user.email, realRow.stake, wallets_);
        return this.admingetExchangeBetHistory(req, res)
    } else {
        return res.json({ status: false, data: "Failure" })
    }
}

exports.betexchg_profitloss = async (req, res, next) => {



    let row = req.body.row
    let start = BaseControl.get_stand_date_end(row.start);
    let end = BaseControl.get_stand_date_end(row.end);

    let userid = req.user._id
    let params = req.body.params;
    let totalcount = 0
    let getcount = await betfairbettinghistory.aggregate([{
        $match: {
            userid: mongoose.Types.ObjectId(userid),
            "DATE": {
                $gte: start,
                $lte: end
            }
        }
    },
    {
        $group: {
            "_id": {
                matchId: "$matchId",
                competitionid: "$competitionid"
            },
            COUNT: { $sum: 1 },
        }
    },
    ])

    if (getcount.length) {
        totalcount = getcount[0].COUNT
    }

    let pages = ReportControl.setpage(params, totalcount);

    let array = await betfairbettinghistory.aggregate([{
        $match: {
            userid: mongoose.Types.ObjectId(userid),
            "DATE": {
                $gte: start,
                $lte: end
            }
        }
    },
    {
        $group: {
            "_id": {
                matchId: "$matchId",
                competitionid: "$competitionid"
            },
            bets: {
                $push: {
                    "sportname": "$sportname",
                    "marketId": "$marketId",
                    "matchId": "$matchId",
                    "competitionid": "$competitionid",
                    "competitionName": "$competitionName",
                    "matchTime": "$matchTime",
                    "matchName": "$matchName",
                    "DATE": "$DATE",
                }
            }
        }
    },

    {
        $skip: pages.skip
    },
    {
        $limit: pages.params.perPage
    }
    ])
    pages["skip2"] = (pages.skip) + array.length;

    let rows = []
    for (let i in array) {
        let profitloss = await getMatchProfit([userid], array[i]._id)
        rows.push(Object.assign({}, { bets: array[i]['bets'][0] }, { profitloss }))
    }

    res.json({ status: true, data: rows, pageset: pages });
    return next()
}

exports.adminbetexchg_profitloss = async (req, res, next) => {

    var orquery = [];
    var role = BaseControl.getUserItem(req)
    userslist = await UsersControl.get_players_items(role);
    for (var i in userslist) {
        orquery.push(mongoose.Types.ObjectId(userslist[i]._id))
    }


    let row = req.body.row
    let start = BaseControl.get_stand_date_end(row.start);
    let end = BaseControl.get_stand_date_end(row.end);

    let userid = req.user._id
    let params = req.body.params;
    let totalcount = 0
    let getcount = await betfairbettinghistory.aggregate([{
        $match: {
            userid: {
                $in: orquery
            },
            "DATE": {
                $gte: start,
                $lte: end
            }
        }
    },
    {
        $group: {
            "_id": {
                matchId: "$matchId",
                competitionid: "$competitionid"
            },
            COUNT: { $sum: 1 },
        }
    },
    ])

    if (getcount.length) {
        totalcount = getcount[0].COUNT
    }

    let pages = ReportControl.setpage(params, totalcount);

    let array = await betfairbettinghistory.aggregate([{
        $match: {
            userid: {
                $in: orquery
            },
            "DATE": {
                $gte: start,
                $lte: end
            }
        }
    },
    {
        $group: {
            "_id": {
                matchId: "$matchId",
                competitionid: "$competitionid"
            },
            bets: {
                $push: {
                    "sportname": "$sportname",
                    "marketId": "$marketId",
                    "matchId": "$matchId",
                    "competitionid": "$competitionid",
                    "competitionName": "$competitionName",
                    "matchTime": "$matchTime",
                    "matchName": "$matchName",
                    "DATE": "$DATE",
                }
            }
        }
    },

    {
        $skip: pages.skip
    },
    {
        $limit: pages.params.perPage
    }
    ])
    pages["skip2"] = (pages.skip) + array.length;

    let rows = []
    for (let i in array) {
        let profitloss = await getMatchProfit(orquery, array[i]._id)
        rows.push(Object.assign({}, { bets: array[i]['bets'][0] }, { profitloss }))
    }

    res.json({ status: true, data: rows, pageset: pages });
    return next()
}

async function getMatchProfit(orquery, ids) {
    let win = await betfairbettinghistory.aggregate([{
        $match: {
            matchId: ids.matchId,
            competitionid: ids.competitionid,
            userid: {
                $in: orquery
            },
        }
    },
    {
        $group: {
            "_id": "$status",
            winamount: {
                $sum: "$profit"
            },
            betamount: {
                $sum: "$stake"
            },
        },
    }
    ])

    let row = {
        "BET": 0,
        "WIN": 0
    }
    if (win.length) {

        for (let i in win) {
            if (win[i]._id === "WIN") {
                row['WIN'] = win[i].winamount
            } else {
                row['BET'] += win[i].betamount
            }
        }
    }
    return parseInt(row.WIN - row.BET)

}

exports.admingetPNLDetail = async (req, res, next) => {
    let userid = req.user._id
    let row = req.body.row
    var orquery = [];
    var role = BaseControl.getUserItem(req)
    userslist = await UsersControl.get_players_items(role);
    for (var i in userslist) {
        orquery.push(mongoose.Types.ObjectId(userslist[i]._id))
    }
    let data = row.bets

    let limits = await getFancylimits()

    // let v = JSON.parse(values)
    let match = {
        event: {
            id: data.matchId
        }
    }
    // match.event.id

    let markets = await getmarketsOld(match, limits)
    let rMarkets = markets.markets

    let Objectdata = {
        "111": [],
        "Match Odds": [],
        "Bookmaker": [],
        "fancys": [],
        "other": [],
    }
    let totalrow = {}
    totalrow['profitloss'] = 0
    totalrow['commission'] = 0
    totalrow['betcount'] = 0
    totalrow['markettype'] = "TOTAL"
    totalrow['marketname'] = ""
    // totalrow['marketname'] = ""

    for (let j in rMarkets) {
        let marketname = j
        let marketitem = rMarkets[j]
        let marketIds = []
        if (marketname === "Match Odds" || marketname === "Bookmaker") {
            marketIds.push({
                result: marketitem.result && marketitem.result.value ? marketitem.result.value : "",
                marketname: marketitem.marketname,
                id: marketitem.marketId,
                markettype: marketname === "Match Odds" ? "MAIN MARKETS" : "Bookmaker"
            })
        } else if (marketname === "other" || marketname === "fancys") {
            for (let k in rMarkets[j]) {

                marketIds.push({
                    result: rMarkets[j][k].result && rMarkets[j][k].result.value ? rMarkets[j][k].result.value : "",
                    id: rMarkets[j][k].marketId,
                    markettype: marketname,
                    marketname: rMarkets[j][k].marketName
                })
            }
        }

        for (let k in marketIds) {
            let pnl = await getPNLfrommarket(data.matchId, data.competitionid, marketIds[k].id)
            let row = {}
            row['result'] = marketIds[k].result
            row['markettype'] = marketIds[k].markettype
            row['commission'] = 0
            row['betcount'] = pnl.betcount
            row['marketname'] = pnl.marketname
            row['profitloss'] = pnl.profit
            row['marketId'] = marketIds[k].id
            Objectdata[marketname].push(row)
            Objectdata['111'].push(row)

            totalrow.profitloss += pnl.profit
            totalrow.betcount += pnl.betcount
        }

    }

    Objectdata['111'].push(totalrow)
    res.send({ status: true, data: Objectdata })
    return next()


    async function getPNLfrommarket(matchId, competitionid, marketId) {
        let win = await betfairbettinghistory.aggregate([{
            $match: {
                userid: {
                    $in: orquery
                },
                matchId,
                competitionid,
                marketId
            }
        },
        {
            $group: {
                "_id": "$status",
                winamount: {
                    $sum: "$profit"
                },
                betamount: {
                    $sum: "$stake"
                },
                count: {
                    $sum: 1
                }
            },
        }
        ])
        let row = {
            "BET": 0,
            "WIN": 0
        }
        let betcount = 0
        if (win.length) {

            for (let i in win) {

                betcount += win[i].count
                if (win[i]._id === "WIN") {
                    row['WIN'] = win[i].winamount
                } else {
                    row['BET'] += win[i].betamount
                }
            }
        }
        let profit = parseInt(row.WIN - row.BET)
        return {
            profit,
            betcount
        }

    }
}

exports.admingetbetFromMarkets = async (req, res, next) => {
    let userid = req.user._id

    var orquery = [];
    var role = BaseControl.getUserItem(req)
    userslist = await UsersControl.get_players_items(role);
    for (var i in userslist) {
        orquery.push(mongoose.Types.ObjectId(userslist[i]._id))
    }

    let matchitem = req.body.matchitem
    let marketId = req.body.marketId
    let rows = await betfairbettinghistory.find({
        userid: {
            $in: orquery
        },
        competitionid: matchitem.bets.competitionid,
        marketId: marketId,
        matchId: matchitem.bets.matchId,
    })

    res.send({ status: true, data: rows })
    return next()
}

exports.getPNLDetail = async (req, res, next) => {

    let userid = req.user._id
    let row = req.body.row

    let data = row.bets

    let limits = await getFancylimits()

    // let v = JSON.parse(values)
    let match = {
        event: {
            id: data.matchId
        }
    }
    // match.event.id

    let markets = await getmarketsOld(match, limits)
    let rMarkets = markets.markets

    let Objectdata = {
        "111": [],
        "Match Odds": [],
        "Bookmaker": [],
        "fancys": [],
        "other": [],
    }
    let totalrow = {}
    totalrow['profitloss'] = 0
    totalrow['commission'] = 0
    totalrow['betcount'] = 0
    totalrow['markettype'] = "TOTAL"
    totalrow['marketname'] = ""
    // totalrow['marketname'] = ""

    for (let j in rMarkets) {
        let marketname = j
        let marketitem = rMarkets[j]
        let marketIds = []
        if (marketname === "Match Odds" || marketname === "Bookmaker") {
            marketIds.push({
                result: marketitem.result && marketitem.result.value ? marketitem.result.value : "",
                marketname: marketitem.marketname,
                id: marketitem.marketId,
                markettype: marketname === "Match Odds" ? "MAIN MARKETS" : "Bookmaker"
            })
        } else if (marketname === "other" || marketname === "fancys") {
            for (let k in rMarkets[j]) {

                marketIds.push({
                    result: rMarkets[j][k].result && rMarkets[j][k].result.value ? rMarkets[j][k].result.value : "",
                    id: rMarkets[j][k].marketId,
                    markettype: marketname,
                    marketname: rMarkets[j][k].marketName
                })
            }
        }

        for (let k in marketIds) {
            let pnl = await getPNLfrommarket(data.matchId, data.competitionid, marketIds[k].id)
            let row = {}
            row['result'] = marketIds[k].result
            row['markettype'] = marketIds[k].markettype
            row['commission'] = 0
            row['betcount'] = pnl.betcount
            row['marketname'] = pnl.marketname
            row['profitloss'] = pnl.profit
            row['marketId'] = marketIds[k].id
            Objectdata[marketname].push(row)
            Objectdata['111'].push(row)

            totalrow.profitloss += pnl.profit
            totalrow.betcount += pnl.betcount
        }

    }

    Objectdata['111'].push(totalrow)
    res.send({ status: true, data: Objectdata })
    return next()


    async function getPNLfrommarket(matchId, competitionid, marketId) {
        let win = await betfairbettinghistory.aggregate([{
            $match: {
                userid: userid,
                matchId,
                competitionid,
                marketId
            }
        },
        {
            $group: {
                "_id": "$status",
                winamount: {
                    $sum: "$profit"
                },
                betamount: {
                    $sum: "$stake"
                },
                count: {
                    $sum: 1
                }
            },
        }
        ])
        let row = {
            "BET": 0,
            "WIN": 0
        }
        let betcount = 0
        if (win.length) {

            for (let i in win) {

                betcount += win[i].count
                if (win[i]._id === "WIN") {
                    row['WIN'] = win[i].winamount
                } else {
                    row['BET'] += win[i].betamount
                }
            }
        }
        let profit = parseInt(row.WIN - row.BET)
        return {
            profit,
            betcount
        }

    }
}

exports.getbetFromMarkets = async (req, res, next) => {

    let userid = req.user._id
    let matchitem = req.body.matchitem
    let marketId = req.body.marketId
    let rows = await betfairbettinghistory.find({
        userid,
        competitionid: matchitem.bets.competitionid,
        marketId: marketId,
        matchId: matchitem.bets.matchId,
    })

    res.send({ status: true, data: rows })
    return next()
}

exports.adminbethistory_email_load = async (req, res, next) => {

    let user = req.user

    let data = req.body.row;
    let params = req.body.params;
    let type = req.body.type;

    let start = BaseControl.get_stand_date_end(data.start);
    let end = BaseControl.get_stand_date_end(data.end);
    let andquery = null
    var rows = [];
    if (type == "1") {
        andquery = {
            DATE: { $gte: start, $lte: end }, userid: mongoose.Types.ObjectId(data.id),
            isSettled: false
        };
    } else {
        andquery = {
            DATE: { $gte: start, $lte: end }, userid: mongoose.Types.ObjectId(data.id),
            isSettled: true
        };
    }

    let totalcount = await betfairbettinghistory.countDocuments(andquery);
    var pages = ReportControl.setpage(params, totalcount);
    if (totalcount > 0) {
        rows = await betfairbettinghistory.find(andquery)
            .populate("sportid").skip(pages.skip).limit(pages.params.perPage);
    }
    pages["skip2"] = (pages.skip) + rows.length;

    res.json({ status: true, data: rows, pageset: pages, });
    return next();
}

exports.admingetExchangeBetHistory = async (req, res) => {
    let { parseFilter } = req.body
    let count = await BaseControl.bGetCount(betfairbettinghistory, {});
    let pages = ReportControl.setpage(parseFilter, count);

    let betList = await betfairbettinghistory.aggregate([{
        $sort: {
            DATE: -1,
        }
    },
    {
        $skip: pages.skip
    },
    {
        $limit: pages.limit
    }
    ]);

    pages["skip1"] = betList.length ? pages.skip + 1 : 0;
    pages["skip2"] = (pages.skip) + betList.length;

    return res.json({
        status: true,
        data: {
            data: betList,
            pages
        }
    })
}

exports.exchangeCancelBet = async (req, res, next) => {
    let data = req.body.item
    let betItem = await BaseControl.BfindOne(betfairbettinghistory, { _id: data._id });
    if (betItem) {
        let returnMoney = 0
        if (betItem.status == "WIN") {
            returnMoney = betItem.profit
        } else {
            returnMoney = betItem.stake
        }
        let ipaddress = BaseControl.get_ipaddress(req)
        let user = await BaseControl.BfindOne(GamePlay, { userid: betItem.userid })
        let wallets_ = {
            commission: 0,
            status: "CANCEL",
            roundid: new Date().valueOf(),
            transactionid: new Date().valueOf(),
            userid: mongoose.Types.ObjectId(betItem.userid),
            credited: returnMoney,
            debited: 0,
            lastbalance: user.balance,
            exchangedata: {
                marketName: betItem.marketName,
                matchName: betItem.matchName,
                oddName: betItem.oddName
            },
            ipaddress
        }
        await BaseControl.email_balanceupdate(user.email, returnMoney, wallets_);
        await BaseControl.BfindOneAndUpdate(betfairbettinghistory, { _id: data._id }, { isSettled: true, isCancel: true })
        this.getBetshistoryload(req, res, next)
        // return res.json({ status: true, data: "Success" })
    } else {
        return res.json({ status: false, data: "Failure" })
    }
}

//  CMS ADMIN
exports.getMatchResultDatas = async (req, res) => {
    let isold = req.body.isold
    let isSettled = false
    if (isold) {
        isSettled = true
    }
    let data = await betfairbettinghistory.aggregate([{
        $match: {
            $and: [{
                isSettled: isSettled
            }]
        }
    },
    {
        $group: {
            _id: "$matchId",
            count: {
                $sum: 1
            },
            allAmount: {
                $sum: "$stake"
            },
            sportsData: {
                $push: {
                    matchName: "$matchName",
                    sportid: "$sportid",
                    matchTime: "$matchTime",
                    competitionid: "$competitionid"
                },
            },
        },
    }
    ])
    let newData = [];
    let realSportsData = await BaseControl.Bfind(betfairSportslist)

    for (let i = 0; i < data.length; i++) {
        let sportIndex = realSportsData.findIndex(item => String(item._id) == String(data[i].sportsData[0].sportid))
        if (sportIndex != -1) {
            let temp = {
                _id: data[i]._id,
                count: data[i].count,
                allAmount: data[i].allAmount,
                count: data[i].count,
                matchName: data[i].sportsData[0].matchName,
                sportType: realSportsData[sportIndex].name,
                matchTime: data[i].sportsData[0].matchTime,
                competitionid: data[i].sportsData[0].competitionid,
            }
            newData.push(temp);
        }
    }

    newData.sort(function (b, news) {
        return new Date(news.matchTime) - new Date(b.matchTime)
    })

    if (newData.length) {
        return res.json({ status: true, data: newData })
    } else {
        return res.json({ status: false, data: "Failure" })
    }
}

exports.getMatchDetailAdmin = async (req, res) => {
    let { id, competionId, isold } = req.body;
    let matchitem = await betfairmatchlist.findOne({ competitionid: competionId, "event.id": id })

    if (matchitem) {
        let limits = await getFancylimits()
        let markets = await getmarketsOld(matchitem._doc, limits)
        let matchData = Object.assign({}, matchitem._doc, markets);
        getBetAmountAndReturn(matchData, res, isold)
    } else {
        return res.json({ status: false, data: "Failure1" })
    }
}

exports.setResultOfMarket = async (req, res) => {

    let ipaddress = BaseControl.get_ipaddress(req)
    let { marketId, value, eventId, competionId, fancyNum, SelectionId, isfancy } = req.body;

    if (isfancy) {
        if (value == "Suspend" || value == "Cancelled") {
            let marketbyuser = await betfairbettinghistory.aggregate([
                {
                    $match : {
                        matchId: eventId,
                        competitionid: competionId,
                        marketId: marketId,
                        // selectionId: SelectionId,
                        isfancy: true,
                        isSettled: false,
                        isCancel: false
                    }
                },
                {
                    $group : {
                        "_id" : "$userid",
                        bets: {
                            $push: {
                                "price": "$price",
                                "betLoss": "$betLoss",
                                "backlay": "$backlay",
                                "profit": "$profit",
                                "stake": "$stake",
                                "oddName": "$oddName",
                                "selectionId": "$selectionId",
                                "marketName": "$marketName",
                                "matchName": "$matchName",
                                "fanytarget": "$fanytarget",
                                "isfancy": "$isfancy",
                                "oddindex": "$oddindex",
                                "transactionId": "$transactionId"
                            }
                        }
                    }
                }
            ])
    
            
            for (let i in marketbyuser) {
                let userid = marketbyuser[i]._id
                let balsort = await BaseControl.playerFindbyUseridUpdate(userid)
                if (balsort) {

                    let bets = marketbyuser[i].bets
                    let exposure = 0
                    let plofwinner = 0
                    let walletbalance = balsort.balance
                    let betItem = null
                    for (let i in bets) {
                        betItem = bets[i];
                        let updateMoney = 0
                    
                        if (betItem.backlay == "back") {
                            if (fancyNum >= betItem.oddindex  ) {
                                updateMoney=betItem.price * betItem.stake
                            } else {
                                updateMoney = betItem.stake * -1
                            }
                        } else {
                            if (fancyNum >= betItem.oddindex ) {
                                updateMoney=betItem.price * betItem.stake * -1
                            } else {
                                updateMoney = betItem.stake
                            }

                        }
                        // if (flag) {
                            plofwinner += updateMoney
                        // }
                        exposure -= (bets[i].stake)
                    }
                    
                    // let wallet = walletbalance - exposure + plofwinner
                    let upBalance = 0 - exposure + plofwinner

                    let wallets_ = {
                        commission: 0,
                        status: value,
                        roundid: betItem.transactionId,
                        transactionid: betItem.transactionId,
                        userid: mongoose.Types.ObjectId(userid),
                        credited: upBalance,
                        debited: 0,
                        lastbalance: balsort.balance,
                        exchangedata: {
                            marketName: betItem.marketName,
                            matchName: betItem.matchName,
                            oddName: betItem.oddName,
                            price: betItem.price,
                            backlay: betItem.backlay,
                            isfancy: betItem.isfancy,
                            fanytarget: betItem.fanytarget
                        },
                        ipaddress
                    }

                    let upbalhan =  await BaseControl.email_balanceupdate(balsort.email, upBalance * -1, wallets_);
                    if ( upbalhan === false) {

                    } 
                }
            }

            let rd =  await betfairbettinghistory.updateMany({
                matchId: eventId,
                competitionid: competionId,
                marketId: marketId,
                // selectionId: SelectionId,
                isfancy: true,
                isSettled: false,
                isCancel: false
            }, {isSettled: true, status: value})
        } else {
            let marketbyuser = await betfairbettinghistory.aggregate([
                {
                    $match : {
                        matchId: eventId,
                        competitionid: competionId,
                        marketId: marketId,
                        // selectionId: SelectionId,
                        isfancy: true,
                        isSettled: false,
                        isCancel: false
                    }
                },
                {
                    $group : {
                        "_id" : "$userid",
                        bets: {
                            $push: {
                                "price": "$price",
                                "betLoss": "$betLoss",
                                "backlay": "$backlay",
                                "profit": "$profit",
                                "stake": "$stake",
                                "oddName": "$oddName",
                                "selectionId": "$selectionId",
                                "marketName": "$marketName",
                                "matchName": "$matchName",
                                "fanytarget": "$fanytarget",
                                "isfancy": "$isfancy",
                                "oddindex": "$oddindex",
                                "transactionId": "$transactionId"
                            }
                        }
                    }
                }
            ])
    
            
            for (let i in marketbyuser) {
                let userid = marketbyuser[i]._id
                let balsort = await BaseControl.playerFindbyUseridUpdate(userid)
                if (balsort) {
    
                    let bets = marketbyuser[i].bets
                    let exposure = 0
                    let plofwinner = 0
                    let walletbalance = balsort.balance
                    let betItem = null
                    for (let i in bets) {
                        betItem = bets[i];
                        let updateMoney = 0
                      
                        // }
                        if (betItem.backlay == "back") {
                            if (fancyNum >= betItem.oddindex  ) {
                                await BaseControl.BfindOneAndUpdate(
                                    betfairbettinghistory, { _id: betItem._id }, { isSettled: true, status: "WIN" }
                                )
                                updateMoney=betItem.price * betItem.stake
                            } else {
                                await BaseControl.BfindOneAndUpdate(
                                    betfairbettinghistory, { _id: betItem._id }, { isSettled: true, status: "LOSS" }
                                )
                                updateMoney = betItem.stake * -1
                            }
                        } else {
                            if (fancyNum >= betItem.oddindex ) {
                                await BaseControl.BfindOneAndUpdate(
                                    betfairbettinghistory, { _id: betItem._id }, { isSettled: true, status: "WIN" }
                                )
                                updateMoney=betItem.price * betItem.stake * -1
                            } else {
                                await BaseControl.BfindOneAndUpdate(
                                    betfairbettinghistory, { _id: betItem._id }, { isSettled: true, status: "LOSS" }
                                )
                                updateMoney = betItem.stake
                            }

                        }
                        // if (flag) {
                            plofwinner += updateMoney
                        // }
                        exposure -= (bets[i].stake)
                    }
                    
                    // let wallet = walletbalance - exposure + plofwinner
                    let upBalance = 0 - exposure + plofwinner

                    let wallets_ = {
                        commission: 0,
                        status: value,
                        roundid: betItem.transactionId,
                        transactionid: betItem.transactionId,
                        userid: mongoose.Types.ObjectId(userid),
                        credited: upBalance,
                        debited: 0,
                        lastbalance: balsort.balance,
                        exchangedata: {
                            marketName: betItem.marketName,
                            matchName: betItem.matchName,
                            oddName: betItem.oddName,
                            price: betItem.price,
                            backlay: betItem.backlay,
                            isfancy: betItem.isfancy,
                            fanytarget: betItem.fanytarget
                        },
                        ipaddress
                    }

                    let upbalhan =  await BaseControl.email_balanceupdate(balsort.email, upBalance, wallets_);
                    if ( upbalhan === false) {

                    } 
                }
            }

            let rd =  await betfairbettinghistory.updateMany({
                matchId: eventId,
                competitionid: competionId,
                marketId: marketId,
                // selectionId: SelectionId,
                isfancy: true,
                isSettled: false,
                isCancel: false
            }, {isSettled: true})

        }

       
    } else {

        if (value == "Suspend" || value == "Cancelled" ) {
            let marketbyuser = await betfairbettinghistory.aggregate([
                {
                    $match : {
                        matchId: eventId,
                        competitionid: competionId,
                        marketId: marketId,
                        isfancy: false,
                        isSettled: false,
                        isCancel: false
                    }
                },
                {
                    $group : {
                        "_id" : "$userid",
                        bets: {
                            $push: {
                                "price": "$price",
                                "betLoss": "$betLoss",
                                "backlay": "$backlay",
                                "profit": "$profit",
                                "stake": "$stake",
                                "oddName": "$oddName",
                                "selectionId": "$selectionId",
                                "marketName": "$marketName",
                                "matchName": "$matchName",
                                "fanytarget": "$fanytarget",
                                "isfancy": "$isfancy",
                                "transactionId": "$transactionId"
                            }
                        }
                    }
                }
            ])
    
            for (let i in marketbyuser) {
                let userid = marketbyuser[i]._id
                let balsort = await BaseControl.playerFindbyUseridUpdate(userid)
                if (balsort) {
    
                    let bets = marketbyuser[i].bets
    
                    if (bets.length) {
    
                        if (bets[0].status == "Suspend" || bets[0].status == "Cancelled") {
        
                        } else {
                            if (bets[0].status == "WIN") {
    
                            }
                        }
        
                        let exposure =  await this.getExchangeExposure({
                            matchId: eventId,
                            marketId,
                            userid
                        }, bets)
                        let plofwinner = 0
                        let walletbalance = balsort.balance
                        let betItem = null
                        for (let i in bets) {
                            betItem = bets[i];
                            let updateMoney = 0
                            // let flag = false
                            //  = Number(betItem.profit) + Number(betItem.stake)
                            // if (value == "Draw") {
                            //     if (betItem.oddName == value && betItem.backlay == "back") {
                            //         flag = true
                            //         updateMoney = Number(betItem.profit) + Number(betItem.stake)
                            //     }
                            // } else {
                            //     if (betItem.oddName == value && betItem.backlay == "back") {
                            //         flag = true
                            //         updateMoney = Number(betItem.profit) + Number(betItem.stake)
                            //     }
                            //     if (betItem.oddName != value && betItem.backlay != "back") {
                            //         flag = true
                            //         updateMoney = Number(betItem.betLoss) + Number(betItem.stake)
                            //     }
                            // }
                            if (betItem.backlay == "back") {
                                if (betItem.oddName == value) {
                                    updateMoney=(betItem.price - 1) * betItem.stake
                                } else {
                                    updateMoney = betItem.stake * -1
                                }
                            } else {
                                if (betItem.oddName == value) {
                                    updateMoney=(betItem.price - 1) * betItem.stake * -1
                                } else {
                                    updateMoney = betItem.stake
                                }
        
                            }
                            // if (flag) {
                                plofwinner += updateMoney
                            // }
                        }
                        
                        // let wallet = walletbalance - exposure + plofwinner
                        let upBalance = 0 - exposure + plofwinner
        
                        let wallets_ = {
                            commission: 0,
                            status: value,
                            roundid: betItem.transactionId,
                            transactionid: betItem.transactionId,
                            userid: mongoose.Types.ObjectId(userid),
                            credited: 0,
                            debited: upBalance,
                            lastbalance: balsort.balance,
                            exchangedata: {
                                marketName: betItem.marketName,
                                matchName: betItem.matchName,
                                oddName: betItem.oddName,
                                price: betItem.price,
                                backlay: betItem.backlay,
                                isfancy: betItem.isfancy,
                                fanytarget: betItem.fanytarget
                            },
                            ipaddress
                        }
        
                        let upbalhan =  await BaseControl.email_balanceupdate(balsort.email,upBalance * -1, wallets_);
                        if ( upbalhan === false) {
        
                        } 
                    }
                }
            }
        
            let rd =  await betfairbettinghistory.updateMany({
                matchId: eventId,
                competitionid: competionId,
                marketId: marketId,
                isfancy: false,
                isSettled: false,
                isCancel: false
            }, {isSettled: true, status: value })


        } else {

            let marketbyuser = await betfairbettinghistory.aggregate([
                {
                    $match : {
                        matchId: eventId,
                        competitionid: competionId,
                        marketId: marketId,
                        isfancy: false,
                        isSettled: false,
                        isCancel: false
                    }
                },
                {
                    $group : {
                        "_id" : "$userid",
                        bets: {
                            $push: {
                                "price": "$price",
                                "betLoss": "$betLoss",
                                "backlay": "$backlay",
                                "profit": "$profit",
                                "stake": "$stake",
                                "oddName": "$oddName",
                                "selectionId": "$selectionId",
                                "marketName": "$marketName",
                                "matchName": "$matchName",
                                "fanytarget": "$fanytarget",
                                "isfancy": "$isfancy",
                                "transactionId": "$transactionId"
                            }
                        }
                    }
                }
            ])

            for (let i in marketbyuser) {
                let userid = marketbyuser[i]._id
                let balsort = await BaseControl.playerFindbyUseridUpdate(userid)
                if (balsort) {

                    let bets = marketbyuser[i].bets
                    let exposure =  await this.getExchangeExposure({
                        matchId: eventId,
                        marketId,
                        userid
                    }, bets)
                    let plofwinner = 0
                    let walletbalance = balsort.balance
                    let betItem = null
                    for (let i in bets) {
                        betItem = bets[i];
                        let updateMoney = 0
                      
                        if (betItem.backlay == "back") {
                            if (betItem.oddName == value) {
                                await BaseControl.BfindOneAndUpdate(
                                    betfairbettinghistory, { _id: betItem._id }, { isSettled: true, status: "WIN" }
                                )
                                updateMoney=(betItem.price - 1) * betItem.stake
                            } else {
                                await BaseControl.BfindOneAndUpdate(
                                    betfairbettinghistory, { _id: betItem._id }, { isSettled: true, status: "LOSS" }
                                )
                                updateMoney = betItem.stake * -1
                            }
                        } else {
                            if (betItem.oddName == value) {
                                await BaseControl.BfindOneAndUpdate(
                                    betfairbettinghistory, { _id: betItem._id }, { isSettled: true, status: "WIN" }
                                )
                                updateMoney=(betItem.price - 1) * betItem.stake * -1
                            } else {
                                await BaseControl.BfindOneAndUpdate(
                                    betfairbettinghistory, { _id: betItem._id }, { isSettled: true, status: "LOSS" }
                                )
                                updateMoney = betItem.stake
                            }

                        }
                        // if (flag) {
                            plofwinner += updateMoney
                        // }
                    }
                    
                    // let wallet = walletbalance - exposure + plofwinner
                    let upBalance = 0 - exposure + plofwinner

                    let wallets_ = {
                        commission: 0,
                        status: value,
                        roundid: betItem.transactionId,
                        transactionid: betItem.transactionId,
                        userid: mongoose.Types.ObjectId(userid),
                        credited: upBalance,
                        debited: 0,
                        lastbalance: balsort.balance,
                        exchangedata: {
                            marketName: betItem.marketName,
                            matchName: betItem.matchName,
                            oddName: betItem.oddName,
                            price: betItem.price,
                            backlay: betItem.backlay,
                            isfancy: betItem.isfancy,
                            fanytarget: betItem.fanytarget
                        },
                        ipaddress
                    }

                    let upbalhan =  await BaseControl.email_balanceupdate(balsort.email, upBalance, wallets_);
                    if ( upbalhan === false) {

                    } 
                }
            }

            let rd =  await betfairbettinghistory.updateMany({
                matchId: eventId,
                competitionid: competionId,
                marketId: marketId,
                isfancy: false,
                isSettled: false,
                isCancel: false
            }, {isSettled: true})
        }

        
    }
    let uphan =  await betfairmarketlist.findOneAndUpdate({ match_id: eventId, marketId: marketId }, {
        status: false,
        result: {
            value,
            isfancy,
            fancyNum
        }
    })
    if (uphan) {
        return res.json({ status: true, data: "success" })
    } else {
        return res.json({ status: false, data: "fail" })
    }
   
}

exports.setRollbackResultOfMarket = async (req, res) => {
    let ipaddress = BaseControl.get_ipaddress(req)

    let { marketId, eventId, competionId, flag } = req.body;
    let lstmk =  await betfairmarketlist.findOne({ match_id: eventId, marketId: marketId })
    if (lstmk) {
        let {value, fancyNum } = lstmk.result

        if (flag == 1) { // match Odds and book maker
    
            let marketbyuser = await betfairbettinghistory.aggregate([
                {
                    $match : {
                        matchId: eventId,
                        competitionid: competionId,
                        marketId: marketId,
                        isfancy: false,
                        isSettled: true,
                        isCancel: false
                    }
                },
                {
                    $group : {
                        "_id" : "$userid",
                        bets: {
                            $push: {
                                "price": "$price",
                                "betLoss": "$betLoss",
                                "backlay": "$backlay",
                                "profit": "$profit",
                                "stake": "$stake",
                                "oddName": "$oddName",
                                "selectionId": "$selectionId",
                                "marketName": "$marketName",
                                "matchName": "$matchName",
                                "fanytarget": "$fanytarget",
                                "isfancy": "$isfancy",
                                "transactionId": "$transactionId"
                            }
                        }
                    }
                }
            ])
    
            for (let i in marketbyuser) {
                let userid = marketbyuser[i]._id
                let balsort = await BaseControl.playerFindbyUseridUpdate(userid)
                if (balsort) {
    
                    let bets = marketbyuser[i].bets
    
                    if (bets.length) {
    
                        if (bets[0].status == "Suspend" || bets[0].status == "Cancelled") {
        
                        } else {
                            if (bets[0].status == "WIN") {
    
                            }
                        }
        
                        let exposure =  await this.getExchangeExposure({
                            matchId: eventId,
                            marketId,
                            userid
                        }, bets)
                        let plofwinner = 0
                        let walletbalance = balsort.balance
                        let betItem = null
                        for (let i in bets) {
                            betItem = bets[i];
                            let updateMoney = 0
                            // let flag = false
                            //  = Number(betItem.profit) + Number(betItem.stake)
                            // if (value == "Draw") {
                            //     if (betItem.oddName == value && betItem.backlay == "back") {
                            //         flag = true
                            //         updateMoney = Number(betItem.profit) + Number(betItem.stake)
                            //     }
                            // } else {
                            //     if (betItem.oddName == value && betItem.backlay == "back") {
                            //         flag = true
                            //         updateMoney = Number(betItem.profit) + Number(betItem.stake)
                            //     }
                            //     if (betItem.oddName != value && betItem.backlay != "back") {
                            //         flag = true
                            //         updateMoney = Number(betItem.betLoss) + Number(betItem.stake)
                            //     }
                            // }
                            if (betItem.backlay == "back") {
                                if (betItem.oddName == value) {
                                    updateMoney=(betItem.price - 1) * betItem.stake
                                } else {
                                    updateMoney = betItem.stake * -1
                                }
                            } else {
                                if (betItem.oddName == value) {
                                    updateMoney=(betItem.price - 1) * betItem.stake * -1
                                } else {
                                    updateMoney = betItem.stake
                                }
        
                            }
                            // if (flag) {
                                plofwinner += updateMoney
                            // }
                        }
                        
                        // let wallet = walletbalance - exposure + plofwinner
                        let upBalance = 0 - exposure + plofwinner
        
                        let wallets_ = {
                            commission: 0,
                            status: "ROLLBACK",
                            roundid: betItem.transactionId,
                            transactionid: betItem.transactionId,
                            userid: mongoose.Types.ObjectId(userid),
                            credited: 0,
                            debited: upBalance,
                            lastbalance: balsort.balance,
                            exchangedata: {
                                marketName: betItem.marketName,
                                matchName: betItem.matchName,
                                oddName: betItem.oddName,
                                price: betItem.price,
                                backlay: betItem.backlay,
                                isfancy: betItem.isfancy,
                                fanytarget: betItem.fanytarget
                            },
                            ipaddress
                        }
        
                        let upbalhan =  await BaseControl.email_balanceupdate(balsort.email,upBalance * -1, wallets_);
                        if ( upbalhan === false) {
        
                        } 
                    }
                }
            }
        
            let rd =  await betfairbettinghistory.updateMany({
                matchId: eventId,
                competitionid: competionId,
                marketId: marketId,
                isfancy: false,
                isSettled: true,
                isCancel: false
            }, {isSettled: false, status: "BET" })
    
        } else if (flag == 2) { // fancy
            let marketbyuser = await betfairbettinghistory.aggregate([
                {
                    $match : {
                        matchId: eventId,
                        competitionid: competionId,
                        marketId: marketId,
                        // selectionId: SelectionId,
                        isfancy: true,
                        isSettled: true
                    }
                },
                {
                    $group : {
                        "_id" : "$userid",
                        bets: {
                            $push: {
                                "price": "$price",
                                "betLoss": "$betLoss",
                                "backlay": "$backlay",
                                "profit": "$profit",
                                "stake": "$stake",
                                "oddName": "$oddName",
                                "selectionId": "$selectionId",
                                "marketName": "$marketName",
                                "matchName": "$matchName",
                                "fanytarget": "$fanytarget",
                                "isfancy": "$isfancy",
                                "oddindex": "$oddindex",
                                "transactionId": "$transactionId"
                            }
                        }
                    }
                }
            ])
    
            
            for (let i in marketbyuser) {
                let userid = marketbyuser[i]._id
                let balsort = await BaseControl.playerFindbyUseridUpdate(userid)
                if (balsort) {

                    let bets = marketbyuser[i].bets
                    let exposure = 0
                    let plofwinner = 0
                    let walletbalance = balsort.balance
                    let betItem = null
                    for (let i in bets) {
                        betItem = bets[i];
                        let updateMoney = 0
                    
                        if (betItem.backlay == "back") {
                            if (fancyNum >= betItem.oddindex  ) {
                                updateMoney=betItem.price * betItem.stake
                            } else {
                                updateMoney = betItem.stake * -1
                            }
                        } else {
                            if (fancyNum >= betItem.oddindex ) {
                                updateMoney=betItem.price * betItem.stake * -1
                            } else {
                                updateMoney = betItem.stake
                            }

                        }
                        // if (flag) {
                            plofwinner += updateMoney
                        // }
                        exposure -= (bets[i].stake)
                    }
                    
                    // let wallet = walletbalance - exposure + plofwinner
                    let upBalance = 0 - exposure + plofwinner

                    let wallets_ = {
                        commission: 0,
                        status: "ROLLBACK",
                        roundid: betItem.transactionId,
                        transactionid: betItem.transactionId,
                        userid: mongoose.Types.ObjectId(userid),
                        credited: upBalance,
                        debited: 0,
                        lastbalance: balsort.balance,
                        exchangedata: {
                            marketName: betItem.marketName,
                            matchName: betItem.matchName,
                            oddName: betItem.oddName,
                            price: betItem.price,
                            backlay: betItem.backlay,
                            isfancy: betItem.isfancy,
                            fanytarget: betItem.fanytarget
                        },
                        ipaddress
                    }

                    let upbalhan =  await BaseControl.email_balanceupdate(balsort.email, upBalance * -1, wallets_);
                    if ( upbalhan === false) {

                    } 
                }
            }

            let rd =  await betfairbettinghistory.updateMany({
                matchId: eventId,
                competitionid: competionId,
                marketId: marketId,
                // selectionId: SelectionId,
                isfancy: true,
                isSettled: true,
                isCancel: false
            }, {isSettled: false, status: "BET"})
            
        }

        let uphan =  await betfairmarketlist.findOneAndUpdate({ match_id: eventId, marketId: marketId }, { status: true, result: {} })
        if (uphan) {
            return res.json({ status: true, data: "success" })
        } else {
            return res.json({ status: true, data: "fail" })
        }
    } else {
        return res.json({ status: true, data: "fail" })
    }
}

const getBetAmountAndReturn = async (match, res, isold) => {

    let isSettled = false;
    if (isold) {
        isSettled = true
    }

    let rdata = match;
    let allBetsData = await BaseControl.Bfind(betfairbettinghistory, { matchId: match.event.id, isSettled: isSettled });
    let rMarkets = match.markets;
    for (let i in allBetsData) {
        let oneBetItem = allBetsData[i]
        for (let j in rMarkets) {
            if (j == "Match Odds" || j == "Bookmaker") {
                if (rMarkets[j].marketId == oneBetItem.marketId) {
                    for (let k in rMarkets[j].odds) {
                        if (rMarkets[j].odds[k].selectionId == oneBetItem.selectionId) {
                            if (oneBetItem.backlay == "back") {
                                if (rMarkets[j].odds[k].backAmount && rMarkets[j].odds[k].backAmount > 0) {
                                    rMarkets[j].odds[k].backAmount += Number(oneBetItem.stake)
                                } else {
                                    rMarkets[j].odds[k].backAmount = Number(oneBetItem.stake)
                                }
                            } else if (oneBetItem.backlay == "lay") {
                                if (rMarkets[j].odds[k].layAmount && rMarkets[j].odds[k].layAmount > 0) {
                                    rMarkets[j].odds[k].layAmount += Number(oneBetItem.stake)
                                } else {
                                    rMarkets[j].odds[k].layAmount = Number(oneBetItem.stake)
                                }
                            }
                        }
                    }
                }
            } else {
                for (let m in rMarkets[j]) {
                    if (rMarkets[j][m].marketId == oneBetItem.marketId) {
                        for (let k in rMarkets[j][m].odds) {
                            if (oneBetItem.isfancy) {
                                if (rMarkets[j][m].odds[k].SelectionId == oneBetItem.selectionId) {
                                    if (oneBetItem.backlay == "back") {
                                        if (rMarkets[j][m].odds[k].backAmount && rMarkets[j][m].odds[k].backAmount > 0) {
                                            rMarkets[j][m].odds[k].backAmount += Number(oneBetItem.stake)
                                            rMarkets[j][m].odds[k].backfanytarget = (oneBetItem.fanytarget)
                                        } else {
                                            rMarkets[j][m].odds[k].backAmount = Number(oneBetItem.stake)
                                            rMarkets[j][m].odds[k].backfanytarget = (oneBetItem.fanytarget)
                                        }
                                    } else if (oneBetItem.backlay == "lay") {
                                        if (rMarkets[j][m].odds[k].layAmount && rMarkets[j][m].odds[k].layAmount > 0) {
                                            rMarkets[j][m].odds[k].layAmount += Number(oneBetItem.stake)
                                            rMarkets[j][m].odds[k].layfanytarget = (oneBetItem.fanytarget)
                                        } else {
                                            rMarkets[j][m].odds[k].layAmount = Number(oneBetItem.stake)
                                            rMarkets[j][m].odds[k].layfanytarget = (oneBetItem.fanytarget)
                                        }
                                    }
                                }
                            } else {
                                if (rMarkets[j][m].odds[k].selectionId == oneBetItem.selectionId) {
                                    if (oneBetItem.backlay == "back") {
                                        if (rMarkets[j][m].odds[k].backAmount && rMarkets[j][m].odds[k].backAmount > 0) {
                                            rMarkets[j][m].odds[k].backAmount += Number(oneBetItem.stake)
                                        } else {
                                            rMarkets[j][m].odds[k].backAmount = Number(oneBetItem.stake)
                                        }
                                    } else if (oneBetItem.backlay == "lay") {
                                        if (rMarkets[j][m].odds[k].layAmount && rMarkets[j][m].odds[k].layAmount > 0) {
                                            rMarkets[j][m].odds[k].layAmount += Number(oneBetItem.stake)
                                        } else {
                                            rMarkets[j][m].odds[k].layAmount = Number(oneBetItem.stake)
                                        }
                                    }
                                }

                            }
                        }
                    }
                }
            }
        }
    }

    let newMarkets = {}
    for (let i in rMarkets) {
        let newrMarkets = rMarkets[i]
        if (i == "Match Odds" || i == "Bookmaker") {
            let flag = false;
            for (let j in newrMarkets.odds) {
                if (newrMarkets.odds[j].backAmount > 0 || newrMarkets.odds[j].layAmount > 0) {
                    flag = true;
                }
            }
            if (flag) {
                newMarkets[i] = newrMarkets
            }
        } else if (i == "other") {
            let newMarket = []
            for (k in newrMarkets) {
                let flag = false;
                for (let j in newrMarkets[k].odds) {
                    if (newrMarkets[k].odds[j].backAmount > 0 || newrMarkets[k].odds[j].layAmount > 0) {
                        flag = true;
                    }
                }
                if (flag) {
                    newMarket.push(newrMarkets[k])
                }
            }
            if (newMarket.length) {
                newMarkets[i] = newMarket
            }
        } else {
            let newMarket = []
            for (k in newrMarkets) {
                let flag = false;
                let newOdds = []
                for (let j in newrMarkets[k].odds) {
                    if (newrMarkets[k].odds[j].backAmount > 0 || newrMarkets[k].odds[j].layAmount > 0) {
                        newOdds.push(newrMarkets[k].odds[j])
                        flag = true;
                    }
                }
                if (flag) {
                    newrMarkets[k].odds = newOdds
                    newMarket.push(newrMarkets[k])
                }
            }
            if (newMarket.length) {
                newMarkets[i] = newMarket
            }
        }
    }

    rdata = Object.assign({}, rdata, { markets: newMarkets })
    return res.json({ status: true, data: rdata })
}

// this is for lmt ids

exports.getBetradaId = async (req, res) => {
    let url = "https://getxml.betradar.com/betradar/getXmlFeed.php?bookmakerName=Igamez&key=8a1e3da1bd09&xmlFeedName=FileGet2&deleteAfterTransfer=yes"
    let data = await axios.get(url);
    let xml = parse(data.data);
    let xmld = xml.root.children[0].children;

    for (let i = 0; i < xmld.length; i++) {
        let saveData = {
            sourceId: xmld[i].attributes.sourceId,
            sportradarId: xmld[i].attributes.sportradarId
        }
        await BaseControl.BfindOneAndUpdate(betfairIdList, saveData.sourceId, saveData)
    }
    return res.json({ status: true, data: xmld })
}

exports.getIdFromPlayer = async (req, res) => {
    let data = await BaseControl.BfindOne(betfairIdList, { sourceId: req.body.id })
    if(data) {
        return res.json({ status: true, data: data.sportradarId })
    } else {        
        return res.json({ status: false })
    }
}

runLmtCheck()
async function runLmtCheck() {
    setInterval( async() => {
        let url = "https://getxml.betradar.com/betradar/getXmlFeed.php?bookmakerName=Igamez&key=8a1e3da1bd09&xmlFeedName=FileGet2&deleteAfterTransfer=no"
        let data = await axios.get(url);
        let xml = parse(data.data);
        let xmld = xml.root.children[0].children;
        for (let i = 0; i < xmld.length; i++) {
            let saveData = {
                sourceId: xmld[i].attributes.sourceId,
                sportradarId: xmld[i].attributes.sportradarId
            }
            await BaseControl.BfindOneAndUpdate(betfairIdList, saveData.sourceId, saveData)
        }
    }, 1000 * 60 * 60);
}



exports.adminget_accountstatement = async (req, res, next) => {

}



async function getMarketlistAPI(match_id) {
    var config = {
        method: 'get',
        url: `${Marketlist}?match_id=${match_id}`,
        headers: {}
    };

    let markets = []
    await axios(config)
        .then(async function (response) {

            if (response.data.length) {

                for (let i in response.data) {

                    let row = {
                        match_id: match_id,
                        marketId: response.data[i].marketId,
                        marketName: response.data[i].marketName,
                        marketStartTime: response.data[i].marketStartTime,
                        runners: response.data[i].runners,
                        status: true
                    }
                    markets.push(row)
                }
            }
        })
    return markets
}

async function getBookmakerAPI(match_id) {

    let bookitem = null;
    var config = {
        method: 'get',
        url: `${Bookmarkerlist}?id=${match_id}`,
        headers: {}
    };
    await axios(config)
        .then( async function (response) {
            let data = response.data
            if (data && Object.keys(data).length) {
                let key = data.bm
                if (data.bm && data.bm.length) {
                    let rows = data.bm

                    let oddsitems = []

                    for (let i in rows) {

                        let row = rows[i]
                        let item = {
                            status: rows[i].status,
                            back: [
                                {
                                    price: row.b1,
                                    size: row.bs1
                                },
                                {
                                    price: row.b2,
                                    size: row.bs2
                                },
                                {
                                    price: row.b3,
                                    size: row.bs3
                                }
                            ],
                            lay: [
                                {
                                    price: row.l1,
                                    size: row.ls1
                                },
                                {
                                    price: row.l2,
                                    size: row.ls2
                                },
                                {
                                    price: row.l3,
                                    size: row.ls3
                                },

                            ],
                            name: rows[i].nation,
                            selectionId: rows[i].sectionId ? rows[i].sectionId : rows[i].selectionId,
                        }
                        oddsitems.push(item)
                    }

                     bookitem = {
                        match_id,
                        marketId: "999" + rows[0].marketId,
                        marketStartTime: new Date(),
                        oddsstatus: rows[0].status,
                        marketName: "Bookmaker",
                         runners: oddsitems,
                        status: true
                    }
                }
            }
        })
    .catch(function (error) {
    })
    return bookitem
}

async function getmarketsAPI(match, limits) {
    let match_id = match.event.id
    // let mtArray = await getMarketlistAPI(match_id)
    let mtArray = await betfairmarketlist.find({ match_id, status: true })
    let markets = {}
    let inplay = false
    let oddsstatus = ""
    let betstatus = false
    let hda = {
        h: {},
        d: {},
        a: {},
    }
    let bc = 0
    let fc = 0
    let bookmaker = false
    let matchoddmarketid = ""

    // console.log(mtArray,"'---market --------")
    for (let i in mtArray) {
        let m = mtArray[i]
        if (m.marketStartTime === "") {
            continue;
        }
        if (m.marketStartTime !== "") {

        } else {
            betstatus = false
        }

        let marketName = m.marketName
        let odds = []
        let fancys = []
        if (marketName === "Bookmaker") {

        } else {
            fancys = await getFanylistAPI(m.marketId)
            odds = await getoddsAPI(m.marketId, true)
        }

        console.log(odds.inplay,"--odds.inplay--odds.inplay")
        let oddsitems = []
        let oddsrunners = []
        if (odds) {
            oddsstatus = odds.status
            oddsrunners = odds.runners
        } else {

        }

        if (oddsstatus == "CLOSED" || oddsstatus == "SUSPENDED") {
            continue;
        }

        if (oddsrunners) {
            if (oddsrunners.length) {
                if (oddsrunners[0].status == "CLOSED" || oddsrunners[0].status == "SUSPENDED") {
                    continue;
                }
            }
        } else {
            // continue;
        }
        if (oddsrunners) {

            for (let j in m.runners) {
                let run = m.runners[j]
                let odd = oddsrunners.find(obj => obj.selectionId.toString() == run.selectionId.toString())
                if (odd) {
    
                    let ddd = Object.assign({}, {
                        status: odd.status,
                        totalMatched: odd.totalMatched,
                        back: arrayMinordersort(odd.ex.availableToBack),
                        lay: arrayMaxordersort(odd.ex.availableToLay),
                        name: run.runnerName,
                        marketStartTime: run.marketStartTime,
                        selectionId: run.selectionId,
                    })
                    oddsitems.push(ddd)
    
                } else {
                    oddsitems.push({
                        status: "",
                        totalMatched: "",
                        back: [],
                        lay: [],
                        name: run.runnerName,
                        marketStartTime: run.marketStartTime,
                        selectionId: run.selectionId,
                    })
                }
            }
        }

        let cflag = true
        switch (marketName) {
            case "Match Odds":
                matchoddmarketid = m.marketId
                if (oddsstatus == "") {
                    return {}
                }
                cflag = false
                if (m.marketStartTime !== "" && limits['setbetaccepingtime'] && limits['setbetaccepingtime']['matchodd']) {
                    let add = 0
                    if (limits['setbetaccepingtime']['matchodd']['isChecked']) {
                        add = 0
                    } else {
                        add = (Number(limits['setbetaccepingtime']['matchodd']['matchtime']) * 60 * 1000)
                    }
                    let marketStartTime = new Date(m.marketStartTime)
                    let current = new Date(new Date().valueOf() + add)

                    if (marketStartTime < current) {
                        betstatus = true
                    } else {
                        betstatus = false
                    }

                }

                if (odds) {
                    
                    if (odds.inplay) {
                        inplay = true
                    }
                    oddsstatus = odds.status
                    let oddsrunners = odds.runners
                    if (oddsrunners) {

                        for (let j in m.runners) {
                            let run = m.runners[j]
                            let odd = oddsrunners.find(obj => obj.selectionId.toString() == run.selectionId.toString())
                            if (odd) {
    
                              
                                if (j == 0) {
                                    hda.h = {
                                        status: odd.status,
                                        totalMatched: odd.totalMatched,
                                        back: getMaxLayback(odd.ex.availableToBack),
                                        lay: getMaxLayback(odd.ex.availableToLay)
                                    }
                                } else if (j == 1) {
                                    hda.a = {
                                        status: odd.status,
                                        totalMatched: odd.totalMatched,
                                        back: getMaxLayback(odd.ex.availableToBack),
                                        lay: getMaxLayback(odd.ex.availableToLay)
                                    }
                                } else if (j == 2) {
                                    hda.d = {
                                        status: odd.status,
                                        totalMatched: odd.totalMatched,
                                        back: getMaxLayback(odd.ex.availableToBack),
                                        lay: getMaxLayback(odd.ex.availableToLay)
                                    }
                                }
                            } else {
    
                            }
                        }
                    }
                }


                markets[marketName] = {}
                if (odds) {
                    if (odds.inplay) {
                        inplay = true
                    }
                    oddsstatus = odds.status
                }
                
                if (m.result && Object.keys(m.result).length) {
                    betstatus = false
                }

                markets[marketName] = {
                    marketId: m.marketId,
                    marketStartTime: m.marketStartTime,
                    oddsstatus,
                    betstatus,
                    totalMatched: m.totalMatched,
                    marketName,
                    odds: oddsitems,

                }
                break;
            case "Bookmaker":
                bookmaker = m
                break;
            default:
                if (m.marketStartTime !== "" && limits['setbetaccepingtime'] && limits['setbetaccepingtime']['matchodd']) {
                    let add = 0
                    if (limits['setbetaccepingtime']['matchodd']['isChecked']) {
                        add = 0
                    } else {
                        add = (Number(limits['setbetaccepingtime']['matchodd']['matchtime']) * 60 * 1000)
                    }
                    let marketStartTime = new Date(m.marketStartTime)
                    let current = new Date(new Date().valueOf() + add)
                    if (marketStartTime < current) {
                        betstatus = true
                    } else {
                        betstatus = false
                    }

                }

                if (m.result && Object.keys(m.result).length) {
                    betstatus = false
                }

                markets["other"] = []
                markets["other"].push(
                    {
                        marketId: m.marketId,
                        marketStartTime: m.marketStartTime,
                        oddsstatus,
                        betstatus,
                        totalMatched: m.totalMatched,
                        marketName,
                        odds: oddsitems,
                    }
                )
                break;
        }

        if (cflag) {
            continue;
        }
        if (!markets['Match Odds']) {
            continue;
        }
        if (fancys.length) {
            if (m.marketStartTime !== "" && limits['setbetaccepingtime'] && limits['setbetaccepingtime']['fancy']) {
                let add = 0
                if (limits['setbetaccepingtime']['fancy']['isChecked']) {
                    add = 0
                } else {
                    add = (Number(limits['setbetaccepingtime']['fancy']['matchtime']) * 60 * 1000)
                }
                let marketStartTime = new Date(m.marketStartTime)
                let current = new Date(new Date().valueOf() + add)
                if (marketStartTime < current) {
                    betstatus = true
                } else {
                    betstatus = false
                }
            }

            if (!markets["fancys"]) {
                markets["fancys"] = []
            }

            if (m.result && Object.keys(m.result).length) {
                betstatus = false
            }

            markets["fancys"].push({
                marketId: m.marketId,
                marketStartTime: m.marketStartTime,
                oddsstatus,
                betstatus,
                totalMatched: m.totalMatched,
                marketName,
                odds: fancys,
                limits: limits['setfancy']
            })
            fc += fancys.length
        }
    }

     if (bookmaker)  {
        markets["Bookmaker"] = {}
        betstatus = markets['Match Odds'] ? markets['Match Odds'].betstatus : false
        if (bookmaker.result && Object.keys(bookmaker.result).length) {
            betstatus = false
        }
        let bookmakerodd = await getBookmakerAPI(match_id)
        if (bookmakerodd) {

            markets["Bookmaker"] = {
                marketId: bookmakerodd.marketId,
                marketStartTime: bookmakerodd.marketStartTime,
                oddsstatus: bookmakerodd.oddsstatus,
                betstatus,
                marketName: bookmakerodd.marketName,
                odds: bookmakerodd.runners,
                limits: limits['setBookmarker']
            }
        } else {
            markets["Bookmaker"] = {
                marketId: bookmaker.marketId,
                marketStartTime: bookmaker.marketStartTime,
                oddsstatus: bookmaker.oddsstatus,
                betstatus,
                marketName: bookmaker.marketName,
                odds: [],
                limits: limits['setBookmarker']
            }
        }
        bc++
    } 

    return ({ markets, inplay, hda, bc, fc,matchoddmarketid })
}

async function getoddsAPI( marketIds) {

    var config = {
        method: 'get',
        url: `${Oddslist}?marketid=${marketIds}`,
        headers: {}
    };
    let odditem = null
    await axios(config)
        .then(async function (response) {
            if (response.data.length) {
                
              
                    odditem = {
                        marketId: response.data[0].marketId,
                        status: response.data[0].status,
                        inplay: response.data[0].inplay,
                        runners: response.data[0].runners,
                    }
                
            } else {
                
                    odditem = {
                    marketId: marketIds,
                    status: "",
                    inplay: false,
                    runners: [],
                }

                
            }

        }).catch(rdata => {
           
                odditem = {
                    marketId: marketIds,
                    status: "",
                    inplay: false,
                    runners: [],
                }

        })
    return odditem
}


async function getFanylistAPI(marketid) {
    let marketid1 = Number(marketid) > 9991 ? marketid.slice(3, marketid.length) : marketid

    let data = []
    var config = {
        method: 'get',
        url: `${Fancylist}?id=${marketid1}`,
        headers: {}
    };
    await axios(config)
        .then(async function (response) {
            data = response.data.session
        for (let i in data) {
            let row = {
                marketId: marketid,
                GameStatus: data[i].GameStatus,
                RunnerName: data[i].RunnerName,
                SelectionId: data[i].SelectionId,
                LayPrice1: data[i].LayPrice1,
                LaySize1: data[i].LaySize1,
                BackPrice1: data[i].BackPrice1,
                BackSize1: data[i].BackSize1,
                MarkStatus: data[i].MarkStatus,
                display: true
            }
            data.push(row)
        }

    })
    .catch(function (error) {
    });
   return data
}




async function Realtimesportlist() {
    
    let sportslist = []
    let rows = []
    let inplayrows = []
    sportslist = await betfairSportslist.aggregate([
        {
            $match: {
                $and: [{
                    status: true
                }]
            }
        },
        {
            $sort: {
                order: 1
            }
        },
        {
            "$lookup": {
                "from": "betfairbetminmaxes",
                "localField": "_id",
                "foreignField": "betfairSportslistid",
                "as": "minmaxvalue"
            }
        },
        { "$unwind": "$minmaxvalue" },
    ])
    let limits = await getFancylimits()
    for (let i in sportslist) {
        let sport_id = sportslist[i].eventType
        let key = sport_id
        
        const items = await getSerlist(sport_id, false, sportslist[i], limits)
        if (items.length) {
            await ischeckOldmatch(items)
            rows.push({
                key,
                data: {
                    Serlist: items,
                    sport: sportslist[i]
                }
            })
        }
        // const inplayitems = await getSerlist(sport_id, true, sportslist[i], limits)
        // if (inplayitems.length) {
        //     await ischeckOldmatch(items)
        //     inplayrows.push({
        //         key,
        //         data: {
        //             Serlist: inplayitems,
        //             sport: sportslist[i]
        //         }
        //     })
        // }
    }
    redisClient.flushdb((err, result) => {
    })
    inplayredisClient.flushdb(  (err, result) => {  
    })

    for (let i in rows) {
        redisClient.set(rows[i].key, JSON.stringify(rows[i].data))
    }

    for (let i in inplayrows) {
        inplayredisClient.set(inplayrows[i].key, JSON.stringify(inplayrows[i].data))
    }
    console.log("--Realtimesportlist--")
    return "ok"
}

async function getBetfairData() {
    let data = [
        {
            "eventType": "4",
            "name": "Cricket",
            "marketCount": 22
        },
        {
        "eventType": "1",
        "name": "Soccer",
        "marketCount": 2492
    },
    {
        "eventType": "2",
        "name": "Tennis",
        "marketCount": 5578
    },
    ]
    let marketodds = ""
    for (let i in data) {
        marketodds += await getSeriesList(data[i].eventType)
        console.log(marketodds,"--marketodds--")
        await getOddslist(marketodds)
    }
    console.log("--getBetfairData---")
    return "ok"
}


async function getFancylimits() {
    let limits = {}
    let limitsetting = await betfairSetting.find({
        key: {
            $in: ["setBookmarker", "setfancy", "setbetaccepingtime"]
        }
    })

    for (let i in limitsetting) {
        limits[limitsetting[i].key] = limitsetting[i].value
    }
    return limits
}

async function getFanylist(match_id, series_id, sport_id, marketid) {
    let marketid1 = Number(marketid) > 9991 ? marketid.slice(3, marketid.length) : marketid

    let data = []
    var config = {
        method: 'get',
        url: `${Fancylist}?id=${marketid1}`,
        headers: {}
    };
    await axios(config)
        .then(async function (response) {

            data = response.data.session
            let last = []
            if (data.length) {
                last = await betfairfancylist.find({ match_id: match_id, "marketId": marketid })
                await betfairfancylist.updateMany({ match_id: match_id, "marketId": marketid }, { GameStatus: "SUSPENDED" })
            } else {
                await betfairfancylist.updateMany({ match_id: match_id, "marketId": marketid }, { display: false })
            }
            for (let i in data) {
                let item = last.find(obj=> obj.SelectionId == data[i].SelectionId)
                if (item && !item.display) {

                } else {
                    let row = {
                        sportid: sport_id,
                        competitionid: series_id,
                        match_id: match_id,
                        marketId: marketid,
                        GameStatus: data[i].GameStatus,
                        RunnerName: data[i].RunnerName,
                        SelectionId: data[i].SelectionId,
                        LayPrice1: data[i].LayPrice1,
                        LaySize1: data[i].LaySize1,
                        BackPrice1: data[i].BackPrice1,
                        BackSize1: data[i].BackSize1,
                        MarkStatus: data[i].MarkStatus,
                        display: true
                    }
                    await betfairfancylist.findOneAndUpdate({ match_id: row.match_id, "marketId": row.marketId, SelectionId: row.SelectionId }, row, {upsert: true, new: true})
                }
            }

        })
        .catch(function (error) {
            data = []

        });
    return []

}

async function getBookmaker(match_id, series_id, sport_id) {

    let data = []
    var config = {
        method: 'get',
        url: `${Bookmarkerlist}?id=${match_id}`,
        headers: {}
    };
    await axios(config)
        .then( async function (response) {
            data = response.data
            if (data && Object.keys(data).length) {
                let key = data.bm
                if (data.bm && data.bm.length) {
                    let rows = data.bm

                    let oddsitems = []

                    for (let i in rows) {

                        let row = rows[i]
                        let item = {
                            status: rows[i].status,
                            back: [
                                {
                                    price: row.b1,
                                    size: row.bs1
                                },
                                {
                                    price: row.b2,
                                    size: row.bs2
                                },
                                {
                                    price: row.b3,
                                    size: row.bs3
                                }
                            ],
                            lay: [
                                {
                                    price: row.l1,
                                    size: row.ls1
                                },
                                {
                                    price: row.l2,
                                    size: row.ls2
                                },
                                {
                                    price: row.l3,
                                    size: row.ls3
                                },

                            ],
                            name: rows[i].nation,
                            selectionId: rows[i].sectionId ? rows[i].sectionId : rows[i].selectionId,
                        }
                        oddsitems.push(item)
                    }

                    let bookitem = {
                        sportid: sport_id,
                        competitionid: series_id,
                        match_id,
                        marketId: "999" + rows[0].marketId,
                        marketStartTime: new Date(),
                        oddsstatus: rows[0].status,
                        marketName: "Bookmaker",
                         runners: oddsitems,
                        status: true
                    }

                    await betfairmarketlist.findOneAndUpdate({ match_id: bookitem.match_id, "marketId": bookitem.marketId }, bookitem, {upsert: true, new: true})

                }
            }
            return []
        })
        .catch(function (error) {
            return []
        })
}

async function getOddslist( marketIds) {

    var config = {
        method: 'get',
        url: `${Oddslist}?marketid=${marketIds}`,
        headers: {}
    };
    await axios(config)
        .then(async function (response) {
            // if (!response.data.length) {
            //     await betfairmatchlist.findOneAndUpdate({ match_id: match_id,  }, { status: false })
            // } else {
            // }
            for (let i in response.data) {
                // if (response.data[i].status !== "OPEN") {
                //     await betfairmatchlist.findOneAndUpdate({ match_id: match_id,  }, { status: false })
                // }
                let row = {
                    // sportid: sport_id,
                    // competitionid: series_id,
                    // match_id: match_id,
                    marketId: response.data[i].marketId,
                    status: response.data[i].status,
                    inplay: response.data[i].inplay,
                    runners: response.data[i].runners,
                }
                await betfairoddslist.findOneAndUpdate({ "marketId": row.marketId }, row,{upsert: true, new: true})
                if(response.data[i].inplay) {
                    await betfairmarketlist.findOneAndUpdate({ "marketId": row.marketId }, {inplay: true},{upsert: true, new: true})
                }
            }

        }).catch(rdata => {

        })
    return []
}

// async function getmarkets(match, limits) {
//     let match_id = match.event.id
//     let mtArray = await betfairmarketlist.find({ match_id, status: true })
//     let markets = {}
//     let inplay = false
//     let oddsstatus = ""
//     let betstatus = false
//     let hda = {
//         h: {},
//         d: {},
//         a: {},
//     }
//     let bc = 0
//     let fc = 0
//     let bookmaker = false
//     let matchoddmarketid = ""

//     for (let i in mtArray) {
//         let m = mtArray[i]._doc
//         if (m.marketStartTime === "") {
//             continue;
//         }
//         if (m.marketStartTime !== "") {

//         } else {
//             betstatus = false
//         }

//         let marketName = m.marketName
//         let odds = []
//         let fancys = []
//         if (marketName === "Bookmaker") {

//         } else {
//             fancys = await getfanys(m.marketId)
//             odds = await getodds(m.marketId)
//         }

//         let oddsitems = []
//         let oddsrunners = []
//         if (odds.length) {
//             oddsstatus = odds[0].status
//             oddsrunners = odds[0].runners
//         } else {

//         }

//         if (oddsstatus == "CLOSED" || oddsstatus == "SUSPENDED") {
//             continue;
//         }

//         if (oddsrunners) {
//             if (oddsrunners.length) {
//                 if (oddsrunners[0].status == "CLOSED" || oddsrunners[0].status == "SUSPENDED") {
//                     continue;
//                 }
//             }
//         } else {
//             continue;
//         }

//         for (let j in m.runners) {
//             let run = m.runners[j]
//             let odd = oddsrunners.find(obj => obj.selectionId.toString() == run.selectionId.toString())
//             if (odd) {

//                 let ddd = Object.assign({}, {
//                     status: odd.status,
//                     totalMatched: odd.totalMatched,
//                     back: arrayMinordersort(odd.ex.availableToBack),
//                     lay: arrayMaxordersort(odd.ex.availableToLay),
//                     name: run.runnerName,
//                     marketStartTime: run.marketStartTime,
//                     selectionId: run.selectionId,
//                 })
//                 oddsitems.push(ddd)

//             } else {
//                 oddsitems.push({
//                     status: "",
//                     totalMatched: "",
//                     back: [],
//                     lay: [],
//                     name: run.runnerName,
//                     marketStartTime: run.marketStartTime,
//                     selectionId: run.selectionId,
//                 })
//             }
//         }

//         let cflag = true
//         switch (marketName) {
//             case "Match Odds":
//                 inplay = m.inplay
//                 matchoddmarketid = m.marketId
//                 if (oddsstatus == "") {
//                     return {}
//                 }
//                 cflag = false
//                 if (m.marketStartTime !== "" && limits['setbetaccepingtime'] && limits['setbetaccepingtime']['matchodd']) {
//                     let add = 0
//                     if (limits['setbetaccepingtime']['matchodd']['isChecked']) {
//                         add = 0
//                     } else {
//                         add = (Number(limits['setbetaccepingtime']['matchodd']['matchtime']) * 60 * 1000)
//                     }
//                     let marketStartTime = new Date(m.marketStartTime)
//                     let current = new Date(new Date().valueOf() + add)

//                     if (marketStartTime < current) {
//                         betstatus = true
//                     } else {
//                         betstatus = false
//                     }

//                 }

//                 markets[marketName] = {}
//                 if (odds.length) {
//                     // if (odds[0].inplay) {
//                     //     inplay = true
//                     // }
//                     oddsstatus = odds[0].status
//                     let oddsrunners = odds[0].runners
//                     for (let j in m.runners) {
//                         let run = m.runners[j]
//                         let odd = oddsrunners.find(obj => obj.selectionId.toString() == run.selectionId.toString())
//                         if (odd) {

//                             if (j == 0) {
//                                 hda.h = {
//                                     status: odd.status,
//                                     totalMatched: odd.totalMatched,
//                                     back: getMaxLayback(odd.ex.availableToBack),
//                                     lay: getMaxLayback(odd.ex.availableToLay)
//                                 }
//                             } else if (j == 1) {
//                                 hda.a = {
//                                     status: odd.status,
//                                     totalMatched: odd.totalMatched,
//                                     back: getMaxLayback(odd.ex.availableToBack),
//                                     lay: getMaxLayback(odd.ex.availableToLay)
//                                 }
//                             } else if (j == 2) {
//                                 hda.d = {
//                                     status: odd.status,
//                                     totalMatched: odd.totalMatched,
//                                     back: getMaxLayback(odd.ex.availableToBack),
//                                     lay: getMaxLayback(odd.ex.availableToLay)
//                                 }
//                             }
//                         } else {

//                         }
//                     }
//                 }
//                 markets[marketName] = {
//                     marketId: m.marketId,
//                     marketStartTime: m.marketStartTime,
//                     oddsstatus,
//                     betstatus,
//                     totalMatched: m.totalMatched,
//                     marketName,
//                     odds: oddsitems,

//                 }
//                 break;
//             case "Bookmaker":
//                     bookmaker = m
//                 break;
//             default:
//                 if (m.marketStartTime !== "" && limits['setbetaccepingtime'] && limits['setbetaccepingtime']['matchodd']) {
//                     let add = 0
//                     if (limits['setbetaccepingtime']['matchodd']['isChecked']) {
//                         add = 0
//                     } else {
//                         add = (Number(limits['setbetaccepingtime']['matchodd']['matchtime']) * 60 * 1000)
//                     }
//                     let marketStartTime = new Date(m.marketStartTime)
//                     let current = new Date(new Date().valueOf() + add)
//                     if (marketStartTime < current) {
//                         betstatus = true
//                     } else {
//                         betstatus = false
//                     }

//                 }
//                 markets["other"] = []
//                 markets["other"].push(
//                     {
//                         marketId: m.marketId,
//                         marketStartTime: m.marketStartTime,
//                         oddsstatus,
//                         betstatus,
//                         totalMatched: m.totalMatched,
//                         marketName,
//                         odds: oddsitems,
//                     }
//                 )
//                 break;
//         }

//         if (cflag) {
//             continue;
//         }
//         if (!markets['Match Odds']) {
//             continue;
//         }
//         if (fancys.length) {
//             if (m.marketStartTime !== "" && limits['setbetaccepingtime'] && limits['setbetaccepingtime']['fancy']) {
//                 let add = 0
//                 if (limits['setbetaccepingtime']['fancy']['isChecked']) {
//                     add = 0
//                 } else {
//                     add = (Number(limits['setbetaccepingtime']['fancy']['matchtime']) * 60 * 1000)
//                 }
//                 let marketStartTime = new Date(m.marketStartTime)
//                 let current = new Date(new Date().valueOf() + add)
//                 if (marketStartTime < current) {
//                     betstatus = true
//                 } else {
//                     betstatus = false
//                 }
//             }

//             if (!markets["fancys"]) {
//                 markets["fancys"] = []
//             }
//             markets["fancys"].push({
//                 marketId: m.marketId,
//                 marketStartTime: m.marketStartTime,
//                 oddsstatus,
//                 betstatus,
//                 totalMatched: m.totalMatched,
//                 marketName,
//                 odds: fancys,
//                 limits: limits['setfancy']
//             })
//             fc += fancys.length
//         }
//     }

//      if (bookmaker)  {
       
//         markets["Bookmaker"] = {}
//         markets["Bookmaker"] = {
//             marketId: bookmaker.marketId,
//             marketStartTime: bookmaker.marketStartTime,
//             oddsstatus: bookmaker.oddsstatus,
//             betstatus: markets['Match Odds'] ? markets['Match Odds'].betstatus : false,
//             marketName: bookmaker.marketName,
//             odds: bookmaker.runners,
//             limits: limits['setBookmarker']
//         }
//         bc++
//     } 

//     return ({ markets, inplay, hda, bc, fc,matchoddmarketid })
// }


async function getfanys(marketid) {

    let odd = await betfairfancylist.find({ marketId: marketid, display: true })

    let rows = []
    for (let i in odd) {
        rows.push(odd[i]._doc)
    }
    if (odd.length) {
    }
    return rows
}

async function getSeriesList(sport_id) {
    let rdata = []
    let config = {
        method: 'get',
        url: `${Seriest}?sport_id=${sport_id}`,
        headers: {}
    };
    let marketodds= ""
    await axios(config).then(async function (response) {
        for (let i in response.data) {
            let item = response.data[i]
            let row = {
                sportid: sport_id,
                competition: {
                    id: item.competition.id,
                    name: item.competition.name,
                },
                competitionRegion: item.competitionRegion,
                status: true
            }
            rdata.push(row)
            await betfairseriesList.findOneAndUpdate({ sportid: row.sportid, "competition.id": row.competition.id }, row, {upsert: true, new: true})
            marketodds +=  await getMatchList(row.competition.id, sport_id)
        }
    })
    return marketodds
}

async function getMatchList(series_id, sport_id) {
    var config = {
        method: 'get',
        url: `${Matchlist}?series_id=${series_id}`,
        headers: {}
    };
    let marketIds = ""
    await axios(config)
        .then( async function (response) {
            for (let i in response.data) {

                let row = {
                    sportid: sport_id,
                    competitionid: series_id,
                    event: response.data[i].event,
                    status: true
                }

                BaseControl.BfindOneAndUpdate(betfairmatchlist, { competitionid: series_id, "event.id": row.event.id }, row)
                marketIds += await getMarketlist(row.event.id, series_id, sport_id)
                if (sport_id === "4") {
                    getBookmaker(row.event.id, series_id, sport_id,)
                }

            }
        })
    return marketIds
}

async function getMarketlist(match_id, series_id, sport_id) {
    var config = {
        method: 'get',
        url: `${Marketlist}?match_id=${match_id}`,
        headers: {}
    };
    let marketIds = ""
    await axios(config)
        .then(async function (response) {

            if (response.data.length) {

                for (let i in response.data) {

                    let row = {
                        sportid: sport_id,
                        competitionid: series_id,
                        match_id: match_id,
                        marketId: response.data[i].marketId,
                        marketName: response.data[i].marketName,
                        marketStartTime: response.data[i].marketStartTime,
                        runners: response.data[i].runners,
                        status: true
                    }

                    BaseControl.BfindOneAndUpdate(betfairmarketlist, { match_id: row.match_id, "marketId": row.marketId }, row)

                    marketIds += response.data[i].marketId + ","
                    if (sport_id === "4") {
                        getFanylist(match_id, series_id, sport_id, response.data[i].marketId)
                    }
                }
            } else {
                // await betfairmatchlist.findOneAndUpdate({
                //     match_id: match_id, sportid: sport_id,
                //     competitionid: series_id
                // }, { status: false })
            }
        })
    return marketIds
}

async function getSerlist(sport_id, inplay, sport, limits) {
    let rows = []
    let Sarray = await betfairseriesList.find({ sportid: sport_id, status: true })
    for (let i in Sarray) {
        let v = Sarray[i]._doc
        let p = await getmatchs(v, limits, sport_id)
        if (p.length) {
            if (inplay) {
                let mms = []
                for (let j in p) {
                    if (p[j].inplay) {
                        mms.push(p[j])
                    }
                }
                if (mms.length) {
                    rows.push(Object.assign({}, v, { matches: mms }, { sport }))
                }
            } else {
                rows.push(Object.assign({}, v, { matches: p }, { sport }))
            }
        } else {
            await betfairseriesList.findOneAndUpdate({ _id: v._id }, { status: false })
        }
    }
    return rows
}

async function getmatchs(competitions, limits, sport_id) {
    let series_id = competitions.competition.id
    let mArray = await betfairmatchlist.find({ status: true, competitionid: series_id })
    let matches = []

    for (let i in mArray) {
        let v = mArray[i]._doc
        let markets = await getmarketsAPI(v, limits, sport_id)
        if (markets.markets && Object.keys(markets.markets).length) {
            if (markets.markets['Match Odds']) {
                matches.push(Object.assign({}, v, markets))
            } else {
                await betfairmatchlist.findOneAndUpdate({ competitionid: series_id, "event.id": v.event.id }, { status: false })
            }
        } else {
            await betfairmatchlist.findOneAndUpdate({ competitionid: series_id, "event.id": v.event.id }, { status: false })
        }

    }
    return matches
}

async function ischeckOldmatch(items) {
    let marketIds = ""
    let mksobj = {}
    for (let j in items) {
        for (let k in items[j]['matches']) {
            mksobj[items[j]['matches'][k].matchoddmarketid] = items[j]['matches'][k].event.id

            var config = {
                method: 'get',
                url: `${Oddslist}?market_id=${items[j]['matches'][k].matchoddmarketid}`,
                headers: {}
            };
            await axios(config)
                .then(async function (response) {


                    let newobj = Object.assign({}, mksobj)
                    for (let i in response.data) {
                        if (response.data[i].status != "CLOSED" && response.data[i].runners.length) {
                        // if (response.data[i].status != "CLOSED") {
                            let marketId = response.data[i].marketId
                            delete newobj[marketId]
                        }
                    }
                    for (let i in newobj) {
                        await betfairmatchlist.findOneAndUpdate({ "event.id": newobj[i] }, { status: false })
                    }
                })
            // marketIds += items[j]['matches'][k].matchoddmarketid + ","
        }
    }
}
