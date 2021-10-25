const mongoose = require('mongoose');
const basecontroller = require("../controller/basecontroller")
const { Schema } =  require('mongoose')

const FeedbackSections = () => {
    var feedbackschema = new Schema({
        label: { type: String, required: true },
        status: { type: Boolean, default: false },
        isdelete : {type : Boolean, default:false},
        order : {type : Number, default:0},
    })
    return mongoose.model("feedbacksections", feedbackschema)
}

const FeedbackHistory = () => {
    var feedbackschema = new Schema({
        detail: { type: String, required: true },
        useragent: { type: String, required: true },
        ipaddress: { type: String, required: true },
        feedbackpoint: { type: Number, default: 0 },
        // userid: { type: Schema.Types.ObjectId, ref: 'user_users' },
        feed: { type: Schema.Types.ObjectId, ref: 'feedbacksections' },
        createAt: { type: Date }
    })

    feedbackschema.pre('save', function () {
        this.set({ createAt: basecontroller.Indiatime() });
    })
    return mongoose.model("feedbackhistory", feedbackschema)
}

module.exports = {
    FeedbackSections: FeedbackSections(),
    FeedbackHistory: FeedbackHistory(),
}
