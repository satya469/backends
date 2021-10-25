const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const basecontroller = require("../controller/basecontroller")

const betfairSportslist = () => {
    const exchgSchema = new Schema({
        eventType: { type: String, required: true },
        name: { type: String, required: true },
        marketCount: { type: Number, required: true },
        order: { type: Number, required: true },
        icon: { type: String, default: "" },
        image: { type: String, default: "" },
        svgicon: { type: Object, default: {} },
        status: { type: Boolean, default: true },
    });
    return mongoose.model('betfairSportslist', exchgSchema)
}

const betfairBetminmax = () => {
    const exchgSchema = new Schema({
        betfairSportslistid: {
            type: Schema.Types.ObjectId, ref: 'betfairSportslist',
        },
        minvalue: { type: Number, required: true },
        maxvalue: { type: Number, required: true },
    });
    return mongoose.model('betfairBetminmax', exchgSchema)
}

const betfairoddsSession = () => {
    const exchgSchema = new Schema({

        sport_id: { type: String, required: true },
        series_id: { type: String, required: true },
        match_id: { type: String, required: true },
        uniqueid: { type: String, required: true },
        marketId: { type: String, required: true },
        socketid: { type: String, required: true },
        date: {
            type: Date, required: true
        }
    });
    return mongoose.model('betfairoddsSession', exchgSchema)
}

const betfairbettinghistory = () => {
    const exchgSchema = new Schema({
        marketId: { type: String, required: true },
        userid: {
            type: Schema.Types.ObjectId, ref: 'user_users'
        },
        sportid: {
            type: Schema.Types.ObjectId, ref: 'betfairSportslist'
        },
        sportname: {
            type: String,
        },
        selectionId: { type: String, required: true },
        matchId: { type: String, required: true },
        oddName: { type: String, required: true },
        oddindex: { type: Number, required: true },
        marketName: { type: String, required: true },
        competitionName: { type: String, required: true },
        ipaddress: { type: String, required: true },
        deviceinfor: { type: Object, required: true },
        competitionid: { type: String, required: true },
        matchName: { type: String, required: true },
        matchTime: { type: String, required: true },
        price: { type: Number, required: true },
        betLoss: { type: Number, required: true },
        lastbalance: { type: Number, required: true },
        updatedbalance: { type: Number, required: true },

        backlay: { type: String, required: true },
        profit: { type: Number, required: true },
        stake: { type: Number, required: true },
        transactionId: { type: String, required: true },
        status: { type: String, required: true },
        DATE: {
            type: Date
        },
        isSettled: { type: Boolean, default: false },
        isCancel: { type: Boolean, default: false },
        isfancy: { type: Boolean, default: false },
        fanytarget: { type: String, default: "" },
        matchodd: { type: Boolean, default: false },
        bookmaker: { type: Boolean, default: false },
    });
    exchgSchema.pre('save', function () {
        this.set({ DATE: basecontroller.Indiatime() });
    });
    return mongoose.model('betfairbettinghistory', exchgSchema)
}

const betfairSetting = () => {
    const exchgSchema = new Schema({
        key: { type: String, required: true },
        value: { type: Object, required: true },
    })
    return mongoose.model('betfairSetting', exchgSchema)
}

const betfairseriesList = () => {
    const exchgSchema = new Schema({
        sportid: { type: String, required: true },
        competition: { type: Object, required: true },
        competitionRegion: { type: String, required: true },
        name: { type: String, required: true },
        status: { type: Boolean, required: true },
    })
    return mongoose.model('betfairseriesList', exchgSchema)
}

const betfairmatchlist = () => {
    const exchgSchema = new Schema({
        sportid: { type: String, required: true },
        event: { type: Object, required: true },
        competitionid: { type: String, required: true },
        status: { type: Boolean, required: true },
        matchoption: {
            type: String, default : "Bet Allow"
        },
        bettingamount : {
            type: Object,
            default: {
                maxamount: 0,
                minamount: 0
            }
        }
    })
    return mongoose.model('betfairmatchlist', exchgSchema)
}

const betfairmarketlist = () => {
    const exchgSchema = new Schema({
        sportid: { type: String, required: true },
        match_id: { type: String, required: true },
        competitionid: { type: String, required: true },
        marketId: { type: String, required: true },
        marketName: { type: String, required: true },
        marketStartTime: { type: String, required: true },
        runners: { type: Object, required: true },
        status: { type: Boolean, default: false },
        result: { type: Object, default: {} },
        oddsstatus: { type: String, default: "" },
        inplay: { type: Boolean, default: false },

    })
    return mongoose.model('betfairmarketlist', exchgSchema)
}

const betfairoddslist = () => {
    const exchgSchema = new Schema({
        sportid: { type: String, required: true },
        match_id: { type: String, required: true },
        competitionid: { type: String, required: true },
        marketId: { type: String, required: true },
        status: { type: String, required: true },
        inplay: { type: Boolean, required: true },
        runners: { type: Object, required: true },
    })
    return mongoose.model('betfairoddslist', exchgSchema)
}

const betfairfancylist = () => {
    const exchgSchema = new Schema({
        sportid: { type: String, required: true },
        match_id: { type: String, required: true },
        competitionid: { type: String, required: true },
        marketId: { type: String, required: true },
        status: { type: Boolean, required: true },
        display: { type: Boolean, default: false },
        GameStatus: { type: String, default: "" },
        RunnerName: { type: String, required: true },
        SelectionId: { type: String, required: true },
        LayPrice1: { type: String, required: true },
        LaySize1: { type: String, required: true },
        BackPrice1: { type: String, required: true },
        BackSize1: { type: String, required: true },
        MarkStatus: { type: String, default: "" },
    })
    return mongoose.model('betfairfancylist', exchgSchema)
}

const betfairbookmarker = () => {
    const exchgSchema = new Schema({
        sportid: { type: String, required: true },
        match_id: { type: String, required: true },
        competitionid: { type: String, required: true },
        marketId: { type: String, required: true },
        marketName: { type: String, default: "" },
        marketStartTime: { type: String, default: "" },
        odds: { type: Object, required: true },
        oddsstatus: { type: String, default: "" },
        status: { type: Boolean, default: false }
    })
    return mongoose.model('betfairboomakerlist', exchgSchema)
}

const betfairIdListSchema = () => {
    const exchgSchema = new Schema({
        sourceId: { type: String, required: true },
        sportradarId: { type: String, required: true }
    })
    return mongoose.model('betfair_id', exchgSchema)
}

module.exports = {
    betfairSportslist: betfairSportslist(),
    betfairBetminmax: betfairBetminmax(),
    betfairoddsSession: betfairoddsSession(),
    betfairbettinghistory: betfairbettinghistory(),
    betfairSetting: betfairSetting(),
    betfairseriesList: betfairseriesList(),
    betfairmatchlist: betfairmatchlist(),
    betfairmarketlist: betfairmarketlist(),
    betfairoddslist: betfairoddslist(),
    betfairfancylist: betfairfancylist(),
    betfairbookmarker: betfairbookmarker(),
    betfairIdList: betfairIdListSchema()
}