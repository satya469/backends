const BASECONTROL = require("./basecontroller");
const {PROVIDERMODELS, GAMELISTMODEL} = require("../models/games_model");
const {BettingHistory_model} = require("../models/bethistory_model")
const {BonusHistory} = require("../models/promotion_model")
const {TransactionsHistory,paymentuserdetail} = require("../models/paymentGateWayModel")
const config = "1619266700079"// super igamez
const {adminUser, GamePlay, wallethistory}  = require("../models/users_model")
const Config = require("../config/index.json")
const mongoose = require("mongoose")
const axios = require('axios');
const qs = require('qs');

async function gameidChangeFunction () {

    let rows = await adminUser.find();

    for (let i in rows) {

        let dd = rows[i]
        
        if (Config.USERS.player == dd.permissionid.id) {
            let time = new Date().getTime().toString() + new Date().getTime().toString() + new Date().getTime().toString()
            let id = mongoose.Types.ObjectId(time.slice(0,24));
            let row = Object.assign({},dd._doc);
            let lastid = row._id;
            row['_id'] = id;
            row['username'] = row.username + "_lkr";
            let dh = await adminUser.deleteOne({_id : lastid});
            let sh = await BASECONTROL.data_save(row, adminUser);
            let ph = await GamePlay.updateOne({userid : lastid},{userid : id , id : id, username : row.username});
            let ws1 = await wallethistory.updateMany({userid : lastid },{userid : id})
            let ws2 = await BettingHistory_model.updateMany({userid : lastid },{userid : id})
            let ws3 = await TransactionsHistory.updateMany({userid : lastid },{userid : id})
            let ws4 = await paymentuserdetail.updateMany({userid : lastid },{userid : id})
            let ws5 = await BonusHistory.updateMany({userid : lastid },{userid : id})
        }
    }

}

exports.getgamelist = async (req,res,next) => {
    let ids = ["612915f1415cc415cd32bf46", "612c6bfc415cc415cd32c01a"]
    let arrays =  []
    for (let i in ids) {
        let arr = await GAMELISTMODEL.find({providerid: ids[i]})
        arrays = [...arrays, ...arr]
    }
    res.send(arrays)
}

// run()
async function run () {

    var data = qs.stringify({
       
    });
    var config = {
      method: 'post',
      url: 'https://cms.starkasino.io/admin/gameprovider/getgamelist',
      headers: { },
      data : data
    };
    
    axios(config)
    .then(async function (response) {
        let rows = (response.data)
        let index = 0
        for (let i in rows) {
            let r = await BASECONTROL.BfindOneAndUpdate(GAMELISTMODEL,{_id: rows[i]._id}, rows[i])
            if (r) {
                index ++
            }
        }
    })
    .catch(function (error) {
    });
    
}


exports.providerload =  async(req,res,next)=>{
    
    let filters = req.body.filters;

    if ( filters) {

        let PlatFormfees = await BASECONTROL.getPlatFormFee()
        let array = [];
        var pages = {};
        let andquery = {};
        let bool = filters.bool;
        if (bool && bool.length > 0) {
            andquery["bool." + bool] = true;
        }
        array = await PROVIDERMODELS.find(andquery).sort({order : 1});
        

        let rows = [];
        for (let i in array) {
            let row = Object.assign({},array[i]._doc) ;
            if (config == req.user.permissionid.id) {
                row['enable'] = true
                row['PlatFormfees'] = PlatFormfees
            } else {
                row['PlatFormfees'] = PlatFormfees
            }
            rows.push(row)
        }
        
        // pages["skip2"] = (pages.skip) + array.length;
        res.send({
            status : true ,data:rows, 
            // pageset : pages,
        });
        return next();

    } else {
        res.json({ status : false,data : "fail" })
        return next();
    }
}

exports.providersave = async(req,res,next)=>{
    var sdata = req.body.row;
    if (sdata) {
        var savehandle = await BASECONTROL.data_save(sdata,PROVIDERMODELS);
        if(!savehandle){
            res.json({ status : false,data : "fail" })
            return next();
        }else{
            this.providerload(req,res,next);
        }
    } else {
        res.json({ status : false,data : "fail" })
        return next();
    }
}

exports.providerupdate  = async(req,res,next)=>{
    var indata = req.body.row;
    if (indata) {
        for(var i = 0 ; i < indata.length ; i++)
        {
            var updatehandle =  await BASECONTROL.BfindOneAndUpdate(PROVIDERMODELS,{_id : indata[i]._id},indata[i]);
            if(!updatehandle){
                res.json({status : false,data : "fail"});
                return next();
            }
        }
        this.providerload(req,res,next);
    } else {
        res.json({status : false,data : "fail"});
        return next();
    }
}

exports.providerdelete  = async(req,res,next)=>{
    if (row) {
        var indata = req.body.row;
        var outdata = await PROVIDERMODELS.findOneAndDelete({_id : indata._id});
        if (!outdata) {
            res.json({status : false,data : "fail"})
            return next();
        } else {
            this.providerload(req,res,next);
        }
    } else {
        res.json({status : false,data : "fail"});
        return next();
    }
}