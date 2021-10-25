const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const basecontroller = require("../controller/basecontroller")

const SettingSchema = new Schema({
    type: { type: String, required: true },
    data: { type: Object, default: {} }
})

const ListSchema = new Schema({
    sport_id: { type: Number, required: true },
    image: { type: String, default: "" },
    sport_name: { type: String, required: true },
    viewBox: { type: String, default: "" },
    icon: { type: String, default: "" },
    color: { type: String, default: "" },
    order: { type: Number, default: 0 },
    status: { type: Boolean, default: false },
    isdelete: { type: Boolean, default: false },
});

const BetSchema = new Schema({
    GAMEID: { type: String, required: true },
    gameid: { type: Schema.Types.ObjectId, ref: 'sports_list' },
    USERID: { type: Schema.Types.ObjectId, ref: 'user_users' },
    AMOUNT: { type: Number, required: true },
    TYPE: { type: String, default: "BET" },
    betting: { type: Object, required: true },
    DATE: { type: Date, },
});

const OddSchema = new Schema({
    event_id: { type: String, default: "" },
    event_name: { type: String, default: "" },
    sportid: { type: String, default: "" },
    ScheduledTime: { type: String, default: "" },
    EventStatus: { type: String, default: "" },
    HomeCompetitor: { type: String, default: "" },
    AwayCompetitor: { type: String, default: "" },
    Status: { type: Object, default: {} },
    Venue: { type: Object, default: {} },
    Season: { type: Object, default: {} },
    market: { type: Object, default: {} },
    permission: { type: Boolean, default: true },
    produceStatus: { type: Boolean, default: true },
});

const TimeSchema = new Schema({
    key: { type: String, required: true },
    timestamp: { type: String },
    produceStatus: { type: Boolean },
});

const FeaturesEvents = new Schema({
    gameid: {
        type: Schema.Types.ObjectId, ref: 'sports_list',
    },
    order: {
        type: Number,
        default: 0
    },
});

const oddSchema = new Schema({
    event_id: { type: String },
    sportid: { type: String },
    HomeCompetitor: { type: String },
    AwayCompetitor: { type: String },
    EventStatus: { type: String },
    sportid: { type: Number },
    event_name: { type: String },
    ScheduledTime: { type: Date },
    Season: { type: Object, default: {} },
    Status: { type: Object, default: {} },
    Venue: { type: Object, default: {} },
    market: { type: Array, default: [] },
    permission: { type: Boolean, default: true },
    isfeatured: { type: Boolean, default: true },
    proData: { type: Object, default: {} },
});

BetSchema.pre('save', function () {
    this.set({ DATE: basecontroller.Indiatime() });
});

module.exports = {
    sportsSetting: mongoose.model('sports_setting', SettingSchema),
    sportsTypeList: mongoose.model('sports_list', ListSchema),
    sportsOdds: mongoose.model('sports_oddsChange', OddSchema),
    sportsBet: mongoose.model('sports_bethistory', BetSchema),
    sportsTemp: mongoose.model('sports_timestamp', TimeSchema),
    FeaturesEvents: mongoose.model('sports_featuresEvents', FeaturesEvents),
    sportOdds: mongoose.model('sports_odds', oddSchema)
}