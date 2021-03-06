const BASECONTROL = require("./basecontroller")
const Bazaar_model = require('../models/matka_model').BazaarModel
const GameModel = require('../models/matka_model').GamesModel
const NumbersModel = require('../models/matka_model').NumbersModel
const BetS_models = require('../models/matka_model').matka_betmodels
const Result_model = require('../models/matka_model').result_model
const BazarTypeModel = require('../models/matka_model').BazarTypeModel
const config = require("../db")
const USERS = require("../models/users_model")
const GamePlay = USERS.GamePlay
const fs = require("fs")
const mongoose = require('mongoose')
const reportsControl = require("./reportcontroller")
const { StatusKey, StringKey, KeyString, GameStringKeyId } = require("../config/sconfig")
const { SattaresstrictionDays } = require("../models/matka_model")
const moment = require('moment')
const Matka6Control = require("./satta6controller")
const rp = require('request-promise')
const cheerio = require('cheerio')
const Usercontrol = require("./userscontroller")

exports.getBettingPlayers = async (req, res, next) => {

  const { data, params } = req.body;
  if (data && params) {
    let { bazaritem, gameitem, date } = data;
    if (bazaritem && gameitem && date) {
      let start = BASECONTROL.get_stand_date_end(date);
      let end = BASECONTROL.get_stand_date_end1(date);
      let andquery = { DATE: { $gte: start, $lte: end }, bazaarid: bazaritem._id, gameid: gameitem._id }
      var rows = [];
      let totalcount = await BetS_models.countDocuments(andquery);
      var pages = reportsControl.setpage(params, totalcount);
      if (totalcount > 0) {
        rows = await BetS_models.find(andquery)
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

exports.getNumberOptions = async (type) => {

  let numberoptions = [];

  switch (type) {
    case StringKey.regular:
    case StringKey.starline:
      var dd = await BASECONTROL.Bfind(NumbersModel, { $or: [{ bool: "3" }, { bool: "4" }, { bool: "5" }] });
      for (let i in dd) {
        let item1 = dd[i].gamenumbers;
        for (let j in item1) {
          if (item1[j].length > 3) {
            for (let k in item1[j]) {
              numberoptions.push({ label: item1[j][k], value: item1[j][k] })
            }
          } else {
            numberoptions.push({ label: item1[j], value: item1[j] })
          }
        }
      }
      break;
    case StringKey["king-bazaar"]:
      var dd = await BASECONTROL.BfindOne(NumbersModel, { bool: "2" });
      let item1 = dd.gamenumbers;
      for (let j in item1) {
        for (let k in item1[j]) {
          numberoptions.push({ label: item1[j][k], value: item1[j][k] })
        }
      }
      break;
  }

  return numberoptions
}

exports.get_result = async (req, res, next) => {

  var query = req.body.filters;
  var params = req.body.params;

  if (query && params) {
    var start = BASECONTROL.get_stand_date_first(query.date);
    var end = BASECONTROL.get_stand_date_end1(query.date);
    let options = await Bazaar_model.aggregate([
      {
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
        label += " => " + this.get_date(options[i].timer.opentime)
      }

      if (options[i].timer.closetime) {
        label += " : " + this.get_date(options[i].timer.closetime)
      }

      timerrows.push({ value: options[i].value, timer: options[i].timer, label: label, _id: options[i].value })
    }



    let numberoptions = await this.getNumberOptions(query.bazaartype);

    let array = [];
    let totalcount = await Result_model.countDocuments({ "resultdate": { $gte: start, $lte: end }, bazaartype: query.bazaartype });
    pages = reportsControl.setpage(params, totalcount);
    if (totalcount > 0) {
      array = await Result_model.find({ "resultdate": { $gte: start, $lte: end }, bazaartype: query.bazaartype }).populate("bazaarid").skip(pages.skip).limit(pages.params.perPage);
    }

    pages["skip2"] = (pages.skip) + array.length;
    res.send({
      status: true, data: array,
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

exports.RollbackRegular = async (data, bazarItem, start, end, lastitem, ipaddress) => {

  var { bazaarid, jodiresult, openresult, closeresult } = data;


  // return;

  // if (bazaarid && jodiresult && openresult && closeresult) {
  if (bazaarid && jodiresult && openresult) {


    await this.AceptStatusUpdate(bazaarid, start, end)

    var lastjodiresult = lastitem.jodiresult.toString();
    var lastopenresult = lastitem.openresult.toString();
    var lastcloseresult = lastitem.closeresult.toString();
    var singleAnkOpen = jodiresult.toString()[0];
    var singleAnkClose = jodiresult.toString()[1];


    if (lastitem.closeresult && lastitem.closeresult.length) {
      // rollback
      //----------    open rollback -------------    
      let resitem = {
        jodiresult: jodiresult,
        closeresult: closeresult,
        openresult: openresult,
        update: true
      }

      let save = await BASECONTROL.BfindOneAndUpdate(Result_model, { _id: lastitem._id }, resitem);
      if (save) {

        if (openresult != lastitem.openresult) {
          await openrollback();
          await openbetting();
        }
        ////------------ close rollback ---------
        if (closeresult != lastitem.lastcloseresult) {
          await closerollback();
          await closebetting(StatusKey.pending);
        }

        return true
      } else {
        return true
        // this.get_result(req ,res ,next);
        // res.send({status : false , data : "error"});
        // return next();
      }

    } else {
      //edit


      let resitem = {
        jodiresult: jodiresult,
        closeresult: closeresult ? closeresult : "",
        openresult: openresult,
      }
      // return ;

      let save = await BASECONTROL.BfindOneAndUpdate(Result_model, { _id: lastitem._id }, resitem);
      if (save) {

        // close win
        if (closeresult && closeresult.length) {
          await closebetting(StatusKey.pending);
          // let rejectH = await BetS_models.updateMany({ DATE :   { $gte: start , $lte: end },
          //   bazaarid : mongoose.Types.ObjectId(bazaarid),status : StatusKey.pending},{status : StatusKey.lost});
        }
        // open rollback
        if (openresult != lastitem.openresult) {
          await openrollback();
          await openbetting();
        }

        // this.get_result(req ,res ,next);

        return true
      } else {
        // res.send({status : false , data : "error"});
        // return next();
        return false
      }
    }
    // under close win 
    async function closebetting(closestatus) {

      let Crows = [];

      let SAWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single ank"], time_flag: "2", betnumber: singleAnkClose, status: closestatus
      }).populate("userid");
      Crows = [...Crows, ...SAWinUsers];
      // close single Ank Win users

      let JDWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId.Jodi, betnumber: jodiresult, status: closestatus
      }).populate("userid");
      Crows = [...Crows, ...JDWinUsers];
      // close single Ank Win users

      let SpWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single pana"], time_flag: "2", betnumber: closeresult, status: closestatus
      }).populate("userid");
      Crows = [...Crows, ...SpWinUsers];
      // close single Pana Win users

      let DpWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["double pana"], time_flag: "2", betnumber: closeresult, status: closestatus
      }).populate("userid");
      Crows = [...Crows, ...DpWinUsers];
      // close Double Pana Win users

      let TpWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["tripple pana"], time_flag: "2", betnumber: closeresult, status: closestatus
      }).populate("userid");
      Crows = [...Crows, ...TpWinUsers];
      // close Tripple Pana Win users

      let halfWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["half sangam"], betnumber: openresult, "detail.betnumber": singleAnkClose, status: closestatus
      }).populate("userid");
      Crows = [...Crows, ...halfWinUsers];
      // open half  sangam Win users

      let closehalfWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["half sangam"], betnumber: closeresult, "detail.betnumber": singleAnkOpen, status: closestatus
      }).populate("userid");
      Crows = [...Crows, ...closehalfWinUsers];
      // close half sangam Pana Win users

      let fullWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["full sangam"], betnumber: openresult, "detail.betnumber": closeresult, status: closestatus
      }).populate("userid");
      Crows = [...Crows, ...fullWinUsers];
      // close full sangam Pana Win users



      for (let i in Crows) {

        let row = Crows[i];
        let user = Crows[i].userid;
        let oddsprice = bazarItem["gamelink"][row.gameid].oddsprice;
        let winamount = parseInt(row.amount) * parseInt(oddsprice);

        let wallets_ = {
          commission: 0,
          status: "WIN",
          roundid: row.roundid,
          transactionid: row.transactionid,
          userid: mongoose.Types.ObjectId(user._id),
          credited: winamount,
          debited: 0,
          lastbalance: BASECONTROL.getPlayerBalanceCorrect(user.playerid),
          bazaarid: mongoose.Types.ObjectId(row.bazaarid),
          matkabetid: row._id,
          ipaddress
        }
        let up_db = await BASECONTROL.email_balanceupdate(user.email, winamount, wallets_);

        let item = Object.assign({}, row._doc ? row._doc : row);
        delete item._id;
        item['status'] = StatusKey.win;
        item['winamount'] = winamount;
        item['betacept'] = true;
        let sh = await BASECONTROL.data_save(item, BetS_models);

        // let item = Object.assign({},row._doc);
        // item['status'] = StatusKey.win;
        // let sh = await BASECONTROL.data_save(item,BetS_models);
        // let up_row = await BetS_models.findOneAndUpdate({_id : row._id},{status : StatusKey.win},{upsert : true});

      }
      return true
    }

    async function openrollback() {
      let rows = [];
      ////////////-----------------open rollback ------------
      if (lastjodiresult[0] != jodiresult[0]) {
        let SAWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single ank"], time_flag: "1", betnumber: lastjodiresult[0], status: StatusKey.win
        }).populate("userid");
        rows = [...rows, ...SAWinUsers];
      }
      // open single Ank Win users


      let SpWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single pana"], time_flag: "1", betnumber: lastopenresult, status: StatusKey.win
      }).populate("userid");

      rows = [...rows, ...SpWinUsers];
      // open single Pana Win users

      let DpWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["double pana"], time_flag: "1", betnumber: lastopenresult, status: StatusKey.win
      }).populate("userid");
      rows = [...rows, ...DpWinUsers];
      // open Double Pana Win users

      let TpWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["tripple pana"], time_flag: "1", betnumber: lastopenresult, status: StatusKey.win
      }).populate("userid");
      rows = [...rows, ...TpWinUsers];
      // open Tripple Pana Win users

      for (let i in rows) {

        let row = rows[i];
        let user = rows[i].userid;
        let oddsprice = bazarItem["gamelink"][row.gameid].oddsprice;
        let winamount = parseInt(row.amount) * parseInt(oddsprice);

        let wallets_ = {
          commission: 0,
          status: "CANCELED_WIN",
          roundid: row.roundid,
          transactionid: row.transactionid,
          userid: mongoose.Types.ObjectId(user._id),
          credited: 0,
          debited: winamount,
          lastbalance: BASECONTROL.getPlayerBalanceCorrect(user.playerid),
          bazaarid: mongoose.Types.ObjectId(row.bazaarid),
          matkabetid: row._id,
          ipaddress
        }
        let up_db = await BASECONTROL.email_balanceupdate(user.email, winamount * -1, wallets_);

        let item = Object.assign({}, row._doc ? row._doc : row);
        delete item._id;
        item['status'] = StatusKey.rollback;
        item['betacept'] = true;
        let sh = await BASECONTROL.data_save(item, BetS_models);


      }

      return true
    }

    async function closerollback() {

      let Crows = [];

      if (lastjodiresult[1] != jodiresult[1]) {
        let SAWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single ank"], time_flag: "2", betnumber: lastjodiresult[1], status: StatusKey.win
        }).populate("userid");
        Crows = [...Crows, ...SAWinUsers];
      }
      // close single Ank Win users

      if (lastjodiresult != jodiresult) {
        let JDWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId.Jodi, betnumber: lastjodiresult, status: StatusKey.win
        }).populate("userid");
        Crows = [...Crows, ...JDWinUsers];
        // close single Ank Win users
      }

      let SpWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single pana"], time_flag: "2", betnumber: lastcloseresult, status: StatusKey.win
      }).populate("userid");
      Crows = [...Crows, ...SpWinUsers];
      // close single Pana Win users

      let DpWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["double pana"], time_flag: "2", betnumber: lastcloseresult, status: StatusKey.win
      }).populate("userid");
      Crows = [...Crows, ...DpWinUsers];
      // close Double Pana Win users

      let TpWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["tripple pana"], time_flag: "2", betnumber: lastcloseresult, status: StatusKey.win
      }).populate("userid");
      Crows = [...Crows, ...TpWinUsers];
      // close Tripple Pana Win users

      let halfWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["half sangam"], betnumber: lastopenresult, "detail.betnumber": lastjodiresult[1], status: StatusKey.win
      }).populate("userid");
      Crows = [...Crows, ...halfWinUsers];
      // open half  sangam Win users

      let closehalfWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["half sangam"], betnumber: lastcloseresult, "detail.betnumber": lastjodiresult[0], status: StatusKey.win
      }).populate("userid");
      Crows = [...Crows, ...closehalfWinUsers];
      // close half sangam Pana Win users

      let fullWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["full sangam"], betnumber: lastopenresult, "detail.betnumber": lastcloseresult, status: StatusKey.win
      }).populate("userid");
      Crows = [...Crows, ...fullWinUsers];

      // close full sangam Pana Win users
      for (let i in Crows) {

        let row = Crows[i];
        let user = Crows[i].userid;
        let oddsprice = bazarItem["gamelink"][row.gameid].oddsprice;
        let winamount = parseInt(row.amount) * parseInt(oddsprice);

        let wallets_ = {
          commission: 0,
          status: "CANCELED_WIN",
          roundid: row.roundid,
          transactionid: row.transactionid,
          userid: mongoose.Types.ObjectId(user._id),
          credited: 0,
          debited: winamount,
          lastbalance: BASECONTROL.getPlayerBalanceCorrect(user.playerid),
          bazaarid: mongoose.Types.ObjectId(row.bazaarid),
          matkabetid: row._id,
          ipaddress
        }
        let up_db = await BASECONTROL.email_balanceupdate(user.email, winamount * -1, wallets_);

        let item = Object.assign({}, row._doc ? row._doc : row);
        delete item._id;
        item['status'] = StatusKey.rollback;
        item['betacept'] = true;
        let sh = await BASECONTROL.data_save(item, BetS_models);

      }

      return true
    }

    async function openbetting() {

      let rows = [];

      let SAWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single ank"], time_flag: "1", betnumber: singleAnkOpen, status: StatusKey.pending
      }).populate("userid");
      rows = [...rows, ...SAWinUsers];
      // open single Ank Win users

      let SpWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single pana"], time_flag: "1", betnumber: openresult, status: StatusKey.pending
      }).populate("userid");

      rows = [...rows, ...SpWinUsers];
      // open single Pana Win users

      let DpWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["double pana"], time_flag: "1", betnumber: openresult, status: StatusKey.pending
      }).populate("userid");
      rows = [...rows, ...DpWinUsers];
      // open Double Pana Win users

      let TpWinUsers = await BetS_models.find({
        DATE: { $gte: start, $lte: end },
        bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["tripple pana"], time_flag: "1", betnumber: openresult, status: StatusKey.pending
      }).populate("userid");
      rows = [...rows, ...TpWinUsers];
      // open Tripple Pana Win users

      for (let i in rows) {

        let row = rows[i];
        let user = rows[i].userid;
        let oddsprice = bazarItem["gamelink"][row.gameid].oddsprice;
        let winamount = parseInt(row.amount) * parseInt(oddsprice);

        let wallets_ = {
          commission: 0,
          status: "WIN",
          roundid: row.roundid,
          transactionid: row.transactionid,
          userid: mongoose.Types.ObjectId(user._id),
          credited: winamount,
          debited: 0,
          lastbalance: BASECONTROL.getPlayerBalanceCorrect(user.playerid),
          bazaarid: mongoose.Types.ObjectId(row.bazaarid),
          matkabetid: row._id,
          ipaddress
        }
        let up_db = await BASECONTROL.email_balanceupdate(user.email, winamount, wallets_);
        // let up_row = await BetS_models.findOneAndUpdate({_id : row._id},{status : StatusKey.win},{upsert : true});
        let item = Object.assign({}, row._doc ? row._doc : row);
        delete item._id;
        item['betacept'] = true;
        item['status'] = StatusKey.win;
        item['winamount'] = winamount;
        let sh = await BASECONTROL.data_save(item, BetS_models);
      }
      return true
    }

  } else {
    // res.send({status : false , data : "error"});
    // return next();
    return false
  }
}

exports.RollbackKing = async (data, bazarItem, start, end, lastitem, ipaddress) => {
  const { bazaarid, jodiresult, } = data;

  if (lastitem.jodiresult != jodiresult) {

    let resitem = {
      jodiresult: jodiresult,
      update: true
    }
    let save = await BASECONTROL.BfindOneAndUpdate(Result_model, { _id: lastitem._id }, resitem);
    if (save) {

      let lastjodiresult = lastitem.jodiresult;
      let lastfirstDigit = lastitem.jodiresult[0];
      let lastsecondDigit = lastitem.jodiresult[1];

      let firstDigit = jodiresult[0];
      let secondDigit = jodiresult[1];


      async function rollback() {
        let rows = [];
        let JDWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId.Jodi, time_flag: "1", betnumber: lastjodiresult, status: StatusKey.win
        }).populate("userid");
        rows = [...rows, ...JDWinUsers];
        // open jodi win users

        if (lastfirstDigit != firstDigit) {
          let FDWinUsers = await BetS_models.find({
            DATE: { $gte: start, $lte: end },
            bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["first Digit"], time_flag: "1", betnumber: lastfirstDigit, status: StatusKey.win
          }).populate("userid");
          rows = [...rows, ...FDWinUsers];
          // open first digit win users
        }

        if (lastsecondDigit != secondDigit) {
          let SDWinUsers = await BetS_models.find({
            DATE: { $gte: start, $lte: end },
            bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["second Digit"], time_flag: "1", betnumber: lastsecondDigit, status: StatusKey.win
          }).populate("userid");
          rows = [...rows, ...SDWinUsers];
        }
        // open second digit win users


        for (let i in rows) {

          let row = rows[i];
          let user = rows[i].userid;
          let oddsprice = bazarItem["gamelink"][row.gameid].oddsprice;
          let winamount = parseInt(row.amount) * parseInt(oddsprice);

          let wallets_ = {
            commission: 0,
            status: "CANCELED_WIN",
            roundid: row.roundid,
            transactionid: row.transactionid,
            userid: mongoose.Types.ObjectId(user._id),
            credited: 0,
            debited: winamount,
            lastbalance: BASECONTROL.getPlayerBalanceCorrect(user.playerid),
            bazaarid: mongoose.Types.ObjectId(row.bazaarid),
            matkabetid: row._id,
            ipaddress
          }
          let up_db = await BASECONTROL.email_balanceupdate(user.email, winamount * -1, wallets_);
          // let up_row = await BetS_models.findOneAndUpdate({_id : row._id},{status : StatusKey.cancel},{upsert : true});

          let item = Object.assign({}, row._doc ? row._doc : row);
          delete item._id;
          item['betacept'] = true;
          item['status'] = StatusKey.rollback;
          let sh = await BASECONTROL.data_save(item, BetS_models);

        }
      }

      async function newWinners() {
        let rows = [];

        let JDWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId.Jodi, time_flag: "1", betnumber: jodiresult, status: StatusKey.pending
        }).populate("userid");
        rows = [...rows, ...JDWinUsers];
        // open jodi win users
        let FDWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["first Digit"], time_flag: "1", betnumber: firstDigit, status: StatusKey.pending
        }).populate("userid");
        rows = [...rows, ...FDWinUsers];
        // open first digit win users
        let SDWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["second Digit"], time_flag: "1", betnumber: secondDigit, status: StatusKey.pending
        }).populate("userid");
        rows = [...rows, ...SDWinUsers];
        // open second digit win users
        for (let i in rows) {

          let row = rows[i];
          let user = rows[i].userid;
          let oddsprice = bazarItem["gamelink"][row.gameid].oddsprice;
          let winamount = parseInt(row.amount) * parseInt(oddsprice);

          let wallets_ = {
            commission: 0,
            status: "WIN",
            roundid: row.roundid,
            transactionid: row.transactionid,
            userid: mongoose.Types.ObjectId(user._id),
            credited: winamount,
            debited: 0,
            lastbalance: BASECONTROL.getPlayerBalanceCorrect(user.playerid),
            bazaarid: mongoose.Types.ObjectId(row.bazaarid),
            matkabetid: row._id,
            ipaddress
          }
          let up_db = await BASECONTROL.email_balanceupdate(user.email, winamount, wallets_);

          let item = Object.assign({}, row._doc ? row._doc : row);
          delete item._id;
          item['status'] = StatusKey.win;
          item['betacept'] = true;
          item['winamount'] = winamount;
          let sh = await BASECONTROL.data_save(item, BetS_models);
          // let up_row = await BetS_models.findOneAndUpdate({_id : row._id},{status : StatusKey.win},{upsert : true});
        }
        return
      }
      await rollback()
      await newWinners()

      // this.get_result(req ,res ,next);
      return true
    } else {
      return false
      // res.send({status : false , data : "error"});
      // return next();
    }
  } else {
    // this.get_result(req ,res ,next);
    return true
  }
}

exports.RollbackStartLine = async (data, bazarItem, start, end, lastitem, ipaddress) => {
  const { bazaarid, openresult, jodiresult, startLinetimer } = data;


  if (lastitem.openresult != openresult || startLinetimer != lastitem.startLinetimer) {


    let lastjodiresult = lastitem.jodiresult;
    let lastopenresult = lastitem.openresult;
    let laststartLinetimer = lastitem.startLinetimer;

    let resitem = {
      jodiresult: jodiresult,
      openresult: openresult,
      startLinetimer: startLinetimer,
      update: true
    }

    // return;
    let save = await BASECONTROL.BfindOneAndUpdate(Result_model, { _id: lastitem._id }, resitem);
    if (save) {

      await rollback();
      await newWinnders();

      // this.get_result(req ,res ,next);
      return true

      async function rollback() {
        let rows = [];

        if (lastjodiresult == jodiresult && laststartLinetimer == startLinetimer) {

        } else {
          let SAWinUsers = await BetS_models.find({
            DATE: { $gte: start, $lte: end },
            bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single ank"], time_flag: laststartLinetimer, betnumber: lastjodiresult, status: StatusKey.win
          }).populate("userid");
          rows = [...rows, ...SAWinUsers];
          // open single Ank Win users
        }


        let SPWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single pana"], time_flag: laststartLinetimer, betnumber: lastopenresult, status: StatusKey.win
        }).populate("userid");
        rows = [...rows, ...SPWinUsers];
        // open single pana  Win users

        let DpWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["double pana"], time_flag: laststartLinetimer, betnumber: lastopenresult, status: StatusKey.win
        }).populate("userid");
        rows = [...rows, ...DpWinUsers];
        // open double pana  Win users

        let TPWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["tripple pana"], time_flag: laststartLinetimer, betnumber: lastopenresult, status: StatusKey.win
        }).populate("userid");
        rows = [...rows, ...TPWinUsers];
        // open tripple pana  Win users



        for (let i in rows) {

          let row = rows[i];
          let user = rows[i].userid;
          let oddsprice = bazarItem["gamelink"][row.gameid].oddsprice;
          let winamount = parseInt(row.amount) * parseInt(oddsprice);

          let wallets_ = {
            commission: 0,
            status: "CANCELED_WIN",
            roundid: row.roundid,
            transactionid: row.transactionid,
            userid: mongoose.Types.ObjectId(user._id),
            credited: 0,
            debited: winamount,
            lastbalance: BASECONTROL.getPlayerBalanceCorrect(user.playerid),
            bazaarid: mongoose.Types.ObjectId(row.bazaarid),
            matkabetid: row._id,
            ipaddress
          }
          let up_db = await BASECONTROL.email_balanceupdate(user.email, winamount * -1, wallets_);
          // let up_row = await BetS_models.findOneAndUpdate({_id : row._id},{status : StatusKey.cancel},{upsert : true});

          let item = Object.assign({}, row._doc ? row._doc : row);
          delete item._id;
          item['status'] = StatusKey.rollback;
          item['betacept'] = true;
          let sh = await BASECONTROL.data_save(item, BetS_models);
        }
        return true
      }

      async function newWinnders() {
        let rows = [];

        let SAWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single ank"], time_flag: startLinetimer, betnumber: jodiresult, status: StatusKey.pending
        }).populate("userid");
        rows = [...rows, ...SAWinUsers];
        // open single Ank Win users

        let SPWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single pana"], time_flag: startLinetimer, betnumber: openresult, status: StatusKey.pending
        }).populate("userid");
        rows = [...rows, ...SPWinUsers];
        // open single pana  Win users

        let DpWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["double pana"], time_flag: startLinetimer, betnumber: openresult, status: StatusKey.pending
        }).populate("userid");
        rows = [...rows, ...DpWinUsers];
        // open double pana  Win users

        let TPWinUsers = await BetS_models.find({
          DATE: { $gte: start, $lte: end },
          bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["tripple pana"], time_flag: startLinetimer, betnumber: openresult, status: StatusKey.pending
        }).populate("userid");
        rows = [...rows, ...TPWinUsers];
        for (let i in rows) {

          let row = rows[i];
          let user = rows[i].userid;
          let oddsprice = bazarItem["gamelink"][row.gameid].oddsprice;
          let winamount = parseInt(row.amount) * parseInt(oddsprice);

          let wallets_ = {
            commission: 0,
            status: "WIN",
            roundid: row.roundid,
            transactionid: row.transactionid,
            userid: mongoose.Types.ObjectId(user._id),
            credited: winamount,
            debited: 0,
            lastbalance: BASECONTROL.getPlayerBalanceCorrect(user.playerid),
            bazaarid: mongoose.Types.ObjectId(row.bazaarid),
            matkabetid: row._id,
            ipaddress
          }
          let up_db = await BASECONTROL.email_balanceupdate(user.email, winamount, wallets_);

          let item = Object.assign({}, row._doc ? row._doc : row);
          delete item._id;
          item['status'] = StatusKey.win;
          item['betacept'] = true;
          item['winamount'] = winamount;
          let sh = await BASECONTROL.data_save(item, BetS_models);
          // let up_row = await BetS_models.findOneAndUpdate({_id : row._id},{status : StatusKey.win},{upsert : true});
        }
      }
    } else {
      return false
      // res.send({status : false , data : "error"});
      // return next();
    }
  } else {
    return false
    // res.send({status : false ,data : "error"})
    // return next()
  }
}

exports.update_result = async (req, res, next) => {


  let { data, filters } = req.body;
  if (data && filters) {

    var start = BASECONTROL.get_stand_date_first(filters.date);
    var end = BASECONTROL.get_stand_date_end1(filters.date);
    const { bazaarid, jodiresult, openresult, startLinetimer, closeresult } = data;
    let bazarItem = await Bazaar_model.findOne({ _id: mongoose.Types.ObjectId(bazaarid) });
    if (bazarItem) {
      let type = bazarItem.bazaartype;
      let andquery = { bazaarid: bazarItem._id, resultdate: { $gte: start, $lte: end } }
      if (type == StringKey.starline) {
        andquery['startLinetimer'] = startLinetimer
      }
      let ipaddress = BASECONTROL.get_ipaddress(req)

      let last = await Result_model.findOne(andquery);
      if (last) {

        let timers = bazarItem.timers;
        let isF = false;
        let isF2 = false;

        switch (type) {

          case StringKey.regular:
            if (closeresult && closeresult.length) {
              isF = this.timerChecking(timers.opentime, start);
              isF2 = this.timerChecking(timers.closetime, start)
              if (isF && isF2) {
                let d = await this.RollbackRegular(data, bazarItem, start, end, last, ipaddress);
                if (d) {
                  break;
                } else {
                  res.send({ status: false, data: "fail" });
                  return next();
                }
              } else {
                res.send({ status: false, data: "It is not Bazar Anouncer time. Please wait ..." });
                return next();
              }
            } else {
              isF = this.timerChecking(timers.opentime, start);
              // isF2 = this.timerChecking(timers.closetime,start)
              if (isF) {
                let d = await this.RollbackRegular(data, bazarItem, start, end, last, ipaddress);
                if (d) {
                  break;
                } else {
                  res.send({ status: false, data: "fail" });
                  return next();
                }
              } else {
                res.send({ status: false, data: "It is not Bazar Anouncer time. Please wait ..." });
                return next();
              }
            }

            break;

          case StringKey["king-bazaar"]:
            isF = this.timerChecking(timers.opentime, start);
            if (isF) {
              let d = await this.RollbackKing(data, bazarItem, start, end, last, ipaddress);
              if (d) {
                break;
              } else {
                res.send({ status: false, data: "fail" });
                return next();
              }
            } else {
              res.send({ status: false, data: "It is not Bazar Anouncer time. Please wait ..." });
              return next();
            }

            break;
          default:
            // isF1 = this.timerChecking(timers.opentime,start)
            isF2 = this.stbarzarTimerchecking(startLinetimer, timers, start);
            if (isF2) {
              let d = await this.RollbackStartLine(data, bazarItem, start, end, last, ipaddress)
              if (d) {
                break;
              } else {
                res.send({ status: false, data: "fail" });
                return next();
              }
            } else {
              res.send({ status: false, data: "It is not Bazar Anouncer time. Please wait ..." });
              return next();
            }
            break;
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
    let options = await Bazaar_model.aggregate([
      {
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
      array = await Result_model.find({ "resultdate": { $gte: start, $lte: end }, bazaartype: query.bazaartype }).populate("bazaarid").skip(pages.skip).limit(pages.params.perPage);
    }
    let numberoptions = await this.getNumberOptions(query.bazaartype);

    pages["skip2"] = (pages.skip) + array.length;
    res.send({
      status: true, data: array,
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

    let options = await Bazaar_model.aggregate([
      {
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
      array = await Result_model.find({ bazaartype: query.bazaartype }).populate("bazaarid").skip(pages.skip).limit(pages.params.perPage);
    }
    let numberoptions = await this.getNumberOptions(query.bazaartype);

    pages["skip2"] = (pages.skip) + array.length;
    res.send({
      status: true, data: array,
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

exports.timerChecking = (timers, start) => {

  var date = BASECONTROL.get_stand_date_first(new Date);

  let nowtime = new Date().toTimeString().split(":");

  let hh = parseInt(nowtime[0]);
  let mm = parseInt(nowtime[1]);
  let timer = timers.split(":");
  let HH = parseInt(timer[0]);
  let MM = parseInt(timer[1]);



  if (hh > HH) {
    return true;

  } else if (hh == HH) {
    if (mm > MM) {


      return true;
    } else {

      return false;
    }
  } else {

    if (date > start) {
      return true;
    } else {

      return false;
    }
  }

}

exports.getGamelistOpen = async (type) => {
  var gamelist = await BASECONTROL.BSortfind(GameModel, { isdelete: false }, { _id: 1 });
  let rows = gamelist;
  let gameList = [];
  switch (type) {
    case StringKey.regular:
      gameList.push(rows[0])
      gameList.push(rows[2])
      gameList.push(rows[3])
      gameList.push(rows[4])
      return gameList;
    case StringKey['king-bazaar']:
      gameList.push(rows[1]);
      gameList.push(rows[7]);
      gameList.push(rows[8]);
      return gameList;
    default:
      gameList.push(rows[0]);
      gameList.push(rows[2]);
      gameList.push(rows[3]);
      gameList.push(rows[4]);
      return gameList;
  }
}

exports.BettingOpenStartLine = async (data, userid, bazarItem, start, end, createdate, ipaddress) => {
  const { bazaarid, openresult, jodiresult, startLinetimer } = data;

  let rows = [];

  let SAWinUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single ank"], time_flag: startLinetimer, betnumber: jodiresult, status: StatusKey.pending
  }).populate("userid");
  rows = [...rows, ...SAWinUsers];
  // open single Ank Win users

  let SPWinUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single pana"], time_flag: startLinetimer, betnumber: openresult, status: StatusKey.pending
  }).populate("userid");
  rows = [...rows, ...SPWinUsers];
  // open single pana  Win users

  let DpWinUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["double pana"], time_flag: startLinetimer, betnumber: openresult, status: StatusKey.pending
  }).populate("userid");
  rows = [...rows, ...DpWinUsers];
  // open double pana  Win users

  let TPWinUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["tripple pana"], time_flag: startLinetimer, betnumber: openresult, status: StatusKey.pending
  }).populate("userid");
  rows = [...rows, ...TPWinUsers];
  // open tripple pana  Win users



  let resitem = {
    jodiresult: jodiresult,
    closeresult: "",
    openresult: openresult,
    startLinetimer: startLinetimer,
    bazaarid: mongoose.Types.ObjectId(bazaarid),
    bazaartype: bazarItem.bazaartype,
    resultdate: createdate,
    // userid : userid
  }

  let save = await BASECONTROL.data_save(resitem, Result_model);
  if (save) {
    for (let i in rows) {

      let row = rows[i];
      let user = rows[i].userid;
      let oddsprice = bazarItem["gamelink"][row.gameid].oddsprice;
      let winamount = parseInt(row.amount) * parseInt(oddsprice);

      let wallets_ = {
        commission: 0,
        status: "WIN",
        roundid: row.roundid,
        transactionid: row.transactionid,
        userid: mongoose.Types.ObjectId(user._id),
        credited: winamount,
        debited: 0,
        lastbalance: BASECONTROL.getPlayerBalanceCorrect(user.playerid),
        bazaarid: mongoose.Types.ObjectId(row.bazaarid),
        matkabetid: row._id,
        ipaddress
      }
      let up_db = await BASECONTROL.email_balanceupdate(user.email, winamount, wallets_);
      // let up_row = await BetS_models.findOneAndUpdate({_id : row._id},{status : StatusKey.win},{upsert : true});

      let item = Object.assign({}, row._doc ? row._doc : row);
      delete item._id;
      item['status'] = StatusKey.win;
      item['winamount'] = winamount;
      item['betacept'] = true;

      let sh = await BASECONTROL.data_save(item, BetS_models);

    }
    await this.AceptStatusUpdate(bazaarid, start, end, startLinetimer)
    return true
  } else {
    return false
  }
}

exports.BettingOpenKing = async (data, userid, bazarItem, start, end, createdate, ipaddress) => {
  const { bazaarid, jodiresult, } = data;

  let firstDigit = jodiresult[0];
  let secondDigit = jodiresult[1];
  let rows = [];

  let JDWinUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId.Jodi, time_flag: "1", betnumber: jodiresult, status: StatusKey.pending
  }).populate("userid");
  rows = [...rows, ...JDWinUsers];
  // open jodi win users
  let FDWinUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["first Digit"], time_flag: "1", betnumber: firstDigit, status: StatusKey.pending
  }).populate("userid");
  rows = [...rows, ...FDWinUsers];
  // open first digit win users
  let SDWinUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["second Digit"], time_flag: "1", betnumber: secondDigit, status: StatusKey.pending
  }).populate("userid");
  rows = [...rows, ...SDWinUsers];
  // open second digit win users

  let resitem = {
    jodiresult: jodiresult,
    closeresult: "",
    openresult: "",
    bazaarid: mongoose.Types.ObjectId(bazaarid),
    bazaartype: bazarItem.bazaartype,
    resultdate: createdate,
    // userid : userid
  }


  let save = await BASECONTROL.data_save(resitem, Result_model);
  if (save) {
    for (let i in rows) {

      let row = rows[i];
      let user = rows[i].userid;
      let oddsprice = bazarItem["gamelink"][row.gameid].oddsprice;
      let winamount = parseInt(row.amount) * parseInt(oddsprice);

      let wallets_ = {
        commission: 0,
        status: "WIN",
        roundid: row.roundid,
        transactionid: row.transactionid,
        userid: mongoose.Types.ObjectId(user._id),
        credited: winamount,
        debited: 0,
        lastbalance: BASECONTROL.getPlayerBalanceCorrect(user.playerid),
        bazaarid: mongoose.Types.ObjectId(row.bazaarid),
        matkabetid: row._id,
        ipaddress
      }
      let up_db = await BASECONTROL.email_balanceupdate(user.email, winamount, wallets_);

      // let up_row = await BetS_models.findOneAndUpdate({_id : row._id},{status : StatusKey.win},{upsert : true});

      let item = Object.assign({}, row._doc ? row._doc : row);
      delete item._id;
      item['status'] = StatusKey.win;
      item['winamount'] = winamount;
      item['betacept'] = true;


      let sh = await BASECONTROL.data_save(item, BetS_models);

    }
    await this.AceptStatusUpdate(bazaarid, start, end)

    // let rejectH = await BetS_models.updateMany({ DATE :   { $gte: start , $lte: end },
    //   bazaarid : mongoose.Types.ObjectId(bazaarid),status : StatusKey.pending},{status : StatusKey.lost});
    return true

  } else {
    return false
  }

}

exports.AceptStatusUpdate = async (bazaarid, start, end, startLinetimer) => {
  if (startLinetimer) {
    await BetS_models.updateMany({ bazaarid: mongoose.Types.ObjectId(bazaarid), DATE: { $gte: start, $lte: end }, time_flag: startLinetimer }, { betacept: true })
  } else {
    await BetS_models.updateMany({ bazaarid: mongoose.Types.ObjectId(bazaarid), DATE: { $gte: start, $lte: end } }, { betacept: true })
  }
  return true
  // return d
}

exports.AceptStatusUpdateByids = async (bazaarid, start, end, ids) => {
  await BetS_models.updateMany({
    _id: {
      $in: ids
    }
  }, { betacept: true })
  return true
  // return d
}

exports.BettingOpenRegular = async (data, userid, bazarItem, start, end, createdate, ipaddress) => {
  const { bazaarid, jodiresult, openresult } = data;

  let rows = [];

  let lostusers = []

  let SAWinUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single ank"], time_flag: "1", betnumber: jodiresult, status: StatusKey.pending
  }).populate("userid");
  rows = [...rows, ...SAWinUsers];
  // open single Ank Win users
  let SalostUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single ank"], time_flag: "1", betnumber: { $ne: jodiresult }, status: StatusKey.pending
  }).populate("userid");
  lostusers = [...lostusers, ...SalostUsers];

  let SpWinUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single pana"], time_flag: "1", betnumber: openresult, status: StatusKey.pending
  }).populate("userid");

  rows = [...rows, ...SpWinUsers];
  // open single Pana Win users

  let SpLostUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["single pana"], time_flag: "1", betnumber: { $ne: openresult }, status: StatusKey.pending
  }).populate("userid");

  lostusers = [...lostusers, ...SpLostUsers];
  // open single Pana Win users



  let DpWinUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["double pana"], time_flag: "1", betnumber: openresult, status: StatusKey.pending
  }).populate("userid");
  rows = [...rows, ...DpWinUsers];
  // open Double Pana Win users

  let DplostUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["double pana"], time_flag: "1", betnumber: { $ne: openresult }, status: StatusKey.pending
  }).populate("userid");
  lostusers = [...lostusers, ...DplostUsers];
  // open Double Pana Win users


  let TpWinUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["tripple pana"], time_flag: "1", betnumber: openresult, status: StatusKey.pending
  }).populate("userid");
  rows = [...rows, ...TpWinUsers];
  // open Tripple Pana Win users

  let TpLostUsers = await BetS_models.find({
    DATE: { $gte: start, $lte: end },
    bazaarid: mongoose.Types.ObjectId(bazaarid), gameid: GameStringKeyId["tripple pana"], time_flag: "1", betnumber: { $ne: openresult }, status: StatusKey.pending
  }).populate("userid");
  lostusers = [...lostusers, ...TpLostUsers];
  // open Tripple Pana Win users


  let lostids = []
  for (let i in lostusers) {
    lostids.push(lostusers[i]._id)
  }
  let resitem = {
    jodiresult: jodiresult,
    closeresult: "",
    openresult: openresult,
    bazaarid: mongoose.Types.ObjectId(bazaarid),
    bazaartype: bazarItem.bazaartype,
    resultdate: createdate,
  }
  let save = await BASECONTROL.data_save(resitem, Result_model);
  if (save) {
    for (let i in rows) {

      let row = rows[i];
      let user = rows[i].userid;
      let oddsprice = bazarItem["gamelink"][row.gameid].oddsprice;
      let winamount = parseInt(row.amount) * parseInt(oddsprice);

      let wallets_ = {
        commission: 0,
        status: "WIN",
        roundid: row.roundid,
        transactionid: row.transactionid,
        userid: mongoose.Types.ObjectId(user._id),
        credited: winamount,
        debited: 0,
        lastbalance: BASECONTROL.getPlayerBalanceCorrect(user.playerid),
        bazaarid: mongoose.Types.ObjectId(row.bazaarid),
        matkabetid: row._id,
        ipaddress
      }
      let up_db = await BASECONTROL.email_balanceupdate(user.email, winamount, wallets_);

      let item = Object.assign({}, row._doc ? row._doc : row);
      delete item._id;
      item['status'] = StatusKey.win;
      item['winamount'] = winamount;
      item['betacept'] = true;

      let sh = await BASECONTROL.data_save(item, BetS_models);
    }
    await this.AceptStatusUpdateByids(bazaarid, start, end, lostids)
    return true
  } else {
    return false
  }
}

function gettimeHHMMFromMM(mm) {
  //ss = 1000s
  let h = parseInt(mm / 60);
  let m = mm % 60
  return {
    h: h,
    m: m
  }
}

exports.Sureget_options = (timers, bettingdate) => {

  let gettime1 = new Date(bettingdate).getTime();

  let today = moment(new Date()).format('YYYY-MM-DD');

  let gettime2 = new Date(today).getTime();

  let stepmin = parseInt(parseFloat(timers.interval) * 60);
  stepmin = stepmin > 0 ? stepmin : 60

  var closetime = parseInt((timers.closetime).split(":")[0]);

  var opentime = parseInt(timers.opentime.split(":")[0]);

  var lasttime = timers.opentime.split(":")[1];

  if (opentime > closetime) {
    closetime += 24;
  }

  var options = [];
  let opentimemin = parseInt(timers.opentime.split(":")[1]) + opentime * 60;
  let closetimemin = parseInt(timers.closetime.split(":")[1]) + closetime * 60;

  for (let i = opentimemin; i <= closetimemin; i += stepmin) {
    let hhmm = gettimeHHMMFromMM(i)
    let hh = hhmm.h;
    let mm = hhmm.m;
    if (hh > 23) {
      hh -= 24
    }

    let now = parseInt(new Date().toTimeString().slice(0, 2));
    if (gettime1 > gettime2) {
      // let tt = hh;
      // if (hh > 23) {
      //   tt -= 24;
      // }
      let item = this.get_date(hh + ":" + mm);
      options.push(item);
    } else if (gettime1 === gettime2) {
      if (hh > now) {
        // if (hh > 23) {
        //   let item = this.get_date(hh - 24 + ":" + mm);
        //   options.push(item);
        // } else {
        let item = this.get_date(hh + ":" + mm);
        options.push(item);
        // }
      }
    } else {
      break;
    }
  }
  return options;
}

exports.stbarzarTimerchecking = (startLinetimer, timers, bettingdate) => {
  let timeoptions = this.Sureget_options1(timers, bettingdate)
  if (timeoptions.indexOf(startLinetimer) != -1) {
    return true
  } else {
    return false
  }
}

exports.updateResultfromadmin = async (req, res, next) => {

  let { data, start, end, bazarItem, createdate } = req.body;
  let ipaddress = BASECONTROL.get_ipaddress(req)

  let type = bazarItem.bazaartype;
  let flag = false;

  let andquery = { bazaarid: bazarItem._id, resultdate: { $gte: start, $lte: end } }
  if (type == StringKey.starline) {
    andquery['startLinetimer'] = data.startLinetimer
  }

  let last = await Result_model.findOne(andquery);
  if (last) {
    switch (type) {
      case StringKey.regular:
        flag = await this.RollbackRegular(data, bazarItem, start, end, last, ipaddress);
        break;
      case StringKey["king-bazaar"]:
        flag = await this.RollbackKing(data, bazarItem, start, end, last, ipaddress);
        break;
      default:
        flag = await this.RollbackStartLine(data, bazarItem, start, end, last, ipaddress)
        break;
    }

    if (flag) {
      res.send({ status: true, data: "success" });
      return next();
    } else {
      res.send({ status: false, data: "fail" });
      return next();
    }
  } else {

    // let type = bazarItem.bazaartype;
    // let flag = false;
    let adminuserid = "matka";

    switch (type) {
      case StringKey.regular:
        flag = await this.BettingOpenRegular(data, adminuserid, bazarItem, start, end, createdate, ipaddress);
        break;
      case StringKey["king-bazaar"]:
        flag = await this.BettingOpenKing(data, adminuserid, bazarItem, start, end, createdate, ipaddress);
        break;
      default:
        flag = await this.BettingOpenStartLine(data, adminuserid, bazarItem, start, end, createdate, ipaddress)
        break;
    }

    res.send({ status: false, data: "fail" });
    return next();
  }

}

exports.admincreate_result = async (req, res, next) => {

  let { data, start, end, createdate } = req.body;
  const { bazaarid, } = data;
  let ipaddress = BASECONTROL.get_ipaddress(req)


  let bazarItem = await Bazaar_model.findOne({ _id: mongoose.Types.ObjectId(bazaarid) });
  if (bazarItem) {
    if (data && start && end) {
      let type = bazarItem.bazaartype;
      let flag = false;
      let adminuserid = "matka";

      switch (type) {
        case StringKey.regular:
          flag = await this.BettingOpenRegular(data, adminuserid, bazarItem, start, end, createdate, ipaddress);
          break;
        case StringKey["king-bazaar"]:
          flag = await this.BettingOpenKing(data, adminuserid, bazarItem, start, end, createdate, ipaddress);
          break;
        default:
          flag = await this.BettingOpenStartLine(data, adminuserid, bazarItem, start, end, createdate, ipaddress)
          break;
      }

      if (flag) {
        res.send({ status: true, data: "success" });
        return next();
      } else {
        res.send({ status: false, data: "fail" });
        return next();
      }
    } else {
      res.send({ status: false, data: "fail" });
      return next();
    }
  } else {

  }
}

exports.create_result = async (req, res, next) => {

  let { data, filters } = req.body;
  if (data && filters) {

    var start = BASECONTROL.get_stand_date_first(filters.date);
    var end = BASECONTROL.get_stand_date_end1(filters.date);
    var createdate = BASECONTROL.getBazarCreateDate(filters.date);
    const { bazaarid, jodiresult, openresult, startLinetimer } = data;
    let ipaddress = BASECONTROL.get_ipaddress(req)

    let bazarItem = await Bazaar_model.findOne({ _id: mongoose.Types.ObjectId(bazaarid) });
    if (bazarItem) {

      let last = null
      let type = bazarItem.bazaartype;
      let timers = bazarItem.timers;
      let isF = false;
      let adminuserid = req.user._id

      switch (type) {

        case StringKey.regular:
          last = await Result_model.findOne({ bazaarid: bazarItem._id, resultdate: { $gte: start, $lte: end } });
          if (!last) {
            isF = this.timerChecking(timers.opentime, start);
            if (isF) {
              let d = await this.BettingOpenRegular(data, adminuserid, bazarItem, start, end, createdate, ipaddress);
              if (d) {
                break;
              } else {
                res.send({ status: false, data: "failed" });
                return next();
              }
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
            isF = this.timerChecking(timers.opentime, start);
            if (isF) {
              let d = await this.BettingOpenKing(data, adminuserid, bazarItem, start, end, createdate, ipaddress);
              if (d) {
                break;
              } else {
                res.send({ status: false, data: "fail" });
                return next();
              }
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
            isF1 = this.timerChecking(timers.opentime, start)

            isF2 = this.stbarzarTimerchecking(startLinetimer, timers, start);
            if (isF1 && isF2) {
              let d = await this.BettingOpenStartLine(data, adminuserid, bazarItem, start, end, createdate, ipaddress)
              if (d) {
                break;
              } else {
                res.send({ status: false, data: "fail" });
                return next();
              }
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

      this.get_result(req, res, next);

    } else {
      res.send({ status: false, data: "Error" });
      return next();
    }


  } else {
    res.send({ status: false, data: "Error" });
    return next();

  }

}

exports.get_bets_from_bazarr = async (req, res, next) => {

  var { bazaritem, date } = req.body;
  const numbersData = await NumbersModel.find();

  var start = BASECONTROL.get_stand_date_first(date);
  var end = BASECONTROL.get_stand_date_end1(date);

  var dd = await BetS_models.aggregate([
    {
      $match: {
        $and: [
          {
            bazaarid: mongoose.Types.ObjectId(bazaritem._id),
            "DATE": { $gte: start, $lte: end }
          }
        ],
      }
    },
    {
      $group: {
        "_id": {
          bazaarid: "$bazaarid",
          gameid: "$gameid",
          time_flag: "$time_flag",
          betnumber: "$betnumber",
          "status": "$status",
          userid: "$userid"
        },
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
        winamount: { $sum: "$winamount" },
        userids: {
          $push: {
            userid: "$userid"
          }
        }
      }
    },
    {
      $group: {
        "_id": {
          bazaarid: "$_id.bazaarid",
          gameid: "$_id.gameid",
          time_flag: "$_id.time_flag",
          betnumber: "$_id.betnumber",
          "status": "$_id.status",
        },
        winamount: {
          $sum: "$winamount"
        },
        amount: {
          $sum: "$amount"
        },
        usercount: {
          $sum: "$count"
        },
        userids: {
          $push: {
            userids: "$userids"
          }
        }
      }
    },
    {
      $group: {
        "_id": {
          bazaarid: "$_id.bazaarid",
          gameid: "$_id.gameid",
          time_flag: "$_id.time_flag",
          betnumber: "$_id.betnumber",
        },
        data: {
          $push: {
            "status": "$_id.status",
            "winamount": "$winamount",
            "amount": "$amount",
            "usercount": "$usercount",
            userids: "$userids"
          }
        }
      }
    },
    {
      $group: {
        "_id": {
          bazaarid: "$_id.bazaarid",
          gameid: "$_id.gameid",
          time_flag: "$_id.time_flag",
        },
        betnumbers: {
          $push: {
            "betnumber": "$_id.betnumber",
            "status": "$data",
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
  ])

  if (dd.length) {

    let userrow = {};

    for (var i in dd) {

      userrow[dd[i]['_id']] = {};
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

              let userrow = {}
              for (let p in status[m].userids) {
                for (let p1 in status[m].userids[p]['userids']) {
                  userrow[status[m].userids[p]['userids'][p1]['userid']] = true
                }
              }
              c4[status[m]['status']] = {
                AMOUNT: status[m].amount,
                usercount: status[m].usercount,
                winamount: status[m].winamount,
                userids: userrow,
              }
            }

            c3[numbers[l]['betnumber']] = c4;

          }

          c2[timers[k]['timer']] = c3;

        }

        c1[games[j]['gameid']] = c2;

      }

      userrow[dd[i]['_id']] = c1;

    }


    var dd = await BetS_models.aggregate([
      {
        $match: {
          $and: [
            {
              bazaarid: mongoose.Types.ObjectId(bazaritem._id),
              "DATE": { $gte: start, $lte: end }
            }
          ],
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


    let row = {};

    for (var i in dd) {

      let id1 = dd[i]['_id']
      row[dd[i]['_id']] = {};
      let c1 = {};
      let games = dd[i]['games'];

      for (var j in games) {

        c1[games[j]['gameid']] = {};

        let id2 = games[j]['gameid']

        let timers = games[j]['timers'];
        let c2 = {};

        for (var k in timers) {

          c2[timers[k]['timer']] = {};

          let id3 = timers[k]['timer']

          let numbers = timers[k]['numbers'];
          let c3 = {};

          for (var l in numbers) {

            let status = numbers[l]['status'];
            let c4 = {};
            let id4 = numbers[l]['betnumber']
            for (var m in status) {


              // userrow

              let id5 = status[m]['status']
              c4[status[m]['status']] = {
                AMOUNT: status[m].AMOUNT,
                COUNT: status[m].COUNT,
                winamount: status[m].winamount,
                usercount: userrow[id1][id2][id3][id4][id5].usercount,
                userids: userrow[id1][id2][id3][id4][id5].userids,
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

    for (let i in row) {
      for (let j in row[i]) {
        for (let k in row[i][j]) {
        }
      }
    }
    res.send({ status: true, data: row, numbersData });
    return next()
  } else {
    res.send({ status: true, data: [], numbersData });
    return next()
  }
}

exports.sattabettingCancel = async (req, res, next) => {

  let deleterow = req.body.deleterow;
  let ipaddress = BASECONTROL.get_ipaddress(req)

  let uph = await BASECONTROL.BfindOneAndUpdate(BetS_models, { _id: deleterow._id }, { status: StatusKey.cancel });
  if (uph) {

    // let user = req.user;
    let p_item = await GamePlay.findOne({ id: deleterow.userid });
    if (p_item) {

      let order_no = new Date().valueOf();
      let wallets_ = {
        commission: 0,
        status: "CANCELED_BET",
        roundid: order_no,
        transactionid: order_no,
        userid: mongoose.Types.ObjectId(p_item.id),
        lastbalance: p_item.balance,
        bazaarid: mongoose.Types.ObjectId(deleterow.bazaarid._id),
        matkabetid: deleterow._id,
        ipaddress
      }

      if (deleterow.status == StatusKey.pending) {
        wallets_['credited'] = deleterow.amount
        wallets_['debited'] = 0
        var up_db = await BASECONTROL.email_balanceupdate(p_item.email, deleterow.amount, wallets_);
      } else if (deleterow.status == StatusKey.win) {
        wallets_['credited'] = 0
        wallets_['debited'] = deleterow.winamount
        var up_db = await BASECONTROL.email_balanceupdate(p_item.email, deleterow.amount * -1, wallets_);
      }

      if (up_db === false) {
        res.json({ status: false, data: "fail" });
        return next();
      } else {
        this.adminbethistory_email_load(req, res, next)
      }
    } else {
      res.json({ status: false, data: "fail" });
      return next();
    }

  } else {
    res.json({ status: false, data: "fail" });
    return next();
  }

}

exports.bethistory_email_load = async (req, res, next) => {

  let user = req.user;
  let data = req.body.row;
  let type = req.body.type
  let params = req.body.params;
  let start = BASECONTROL.get_stand_date_end(data.start);
  let end = BASECONTROL.get_stand_date_end(data.end);
  let andquery = { createdAt: { $gte: start, $lte: end }, userid: mongoose.Types.ObjectId(user._id), type: type }
  var rows = [];

  let totalcount = await BetS_models.countDocuments(andquery);
  var pages = reportsControl.setpage(params, totalcount);
  if (totalcount > 0) {
    rows = await BetS_models.find(andquery)
      .populate({ path: "bazaarid" })
      .populate({ path: "gameid", select: "name" }).sort({ createdAt: -1 }).skip(pages.skip).limit(pages.params.perPage);
  }
  pages["skip2"] = (pages.skip) + rows.length;

  res.json({ status: true, data: rows, pageset: pages, });
  return next();

}

exports.adminbethistory_email_load = async (req, res, next) => {

  let data = req.body.row;
  let params = req.body.params;
  let type = req.body.type;
  let start = BASECONTROL.get_stand_date_end(data.start);
  let end = BASECONTROL.get_stand_date_end(data.end);
  let andquery = { createdAt: { $gte: start, $lte: end }, userid: mongoose.Types.ObjectId(data.id), type: type }
  var rows = [];

  let totalcount = await BetS_models.countDocuments(andquery);
  var pages = reportsControl.setpage(params, totalcount);
  if (totalcount > 0) {
    rows = await BetS_models.find(andquery)
      .populate({ path: "bazaarid", select: "bazaarname bazaartype" })
      .populate({ path: "gameid", select: "name" }).sort({ createdAt: -1 }).skip(pages.skip).limit(pages.params.perPage);
  }
  pages["skip2"] = (pages.skip) + rows.length;

  res.json({ status: true, data: rows, pageset: pages, });
  return next();

}

exports.get_bazaars = async (req, res, next) => {

  let params = req.body.params;
  let filters = req.body.filters;
  if (params && filters) {

    let { bazaartype, ownership, blocktime, status, updated_at } = filters
    let start = BASECONTROL.get_stand_date_end(updated_at.start)
    let end = BASECONTROL.get_stand_date_end(updated_at.end)
    let andquery = {
      bazaartype: { $regex: bazaartype },
      ownership: { $regex: ownership },
      status: status,
      updated_at: { $gte: start, $lte: end },
      isdelete: false
    }
    if (blocktime && blocktime.length && parseInt(blocktime)) {
      andquery['blocktime'] = blocktime
    }
    var gamesData = await BASECONTROL.BSortfind(GameModel, { isdelete: false }, { _id: 1 });
    let rows = [];
    if (req.body.first) {
      let totalcount = await Bazaar_model.countDocuments({ isdelete: false });
      var pages = reportsControl.setpage(params, totalcount);
      if (totalcount > 0) {
        rows = await Bazaar_model.find({ isdelete: false }).skip(pages.skip).limit(pages.params.perPage).sort({ updated_at: -1 });
      }
    } else {
      let totalcount = await Bazaar_model.countDocuments(andquery);
      var pages = reportsControl.setpage(params, totalcount);
      if (totalcount > 0) {
        rows = await Bazaar_model.find(andquery).skip(pages.skip).limit(pages.params.perPage).sort({ updated_at: -1 });
      }

    }

    pages["skip2"] = (pages.skip) + rows.length;

    res.json({ status: true, data: rows, pageset: pages, gamelist: gamesData });
    return next();

  } else {
    res.json({ status: false, data: "server error" });
    return next();
  }
}

exports.create_bazaars = async (req, res, next) => {
  var newdata = req.body.data;

  var data = await BASECONTROL.BfindOne(Bazaar_model, { bazaarname: newdata.bazaarname });
  if (!data) {
    var sv_hd = await BASECONTROL.data_save(newdata, Bazaar_model);
    if (sv_hd) {
      this.get_bazaars(req, res, next);
    } else {
      res.json({ status: false, data: "server error" });
      return next();
    }
  } else {
    res.json({ status: false, data: "Bazaar name already exist" });
    return next();
  }
}

exports.update_bazaars = async (req, res, next) => {
  var updata = req.body.data;
  var lastdata = await BASECONTROL.BfindOneAndUpdate(Bazaar_model, { _id: updata._id }, updata);
  if (lastdata) {
    this.get_bazaars(req, res, next);
  } else {
    res.json({ status: false, data: "we can't find this item" });
    return next();
  }
}

exports.delete_bazaars = async (req, res, next) => {
  var delitem = req.body.data;
  var del_hd = await BASECONTROL.BfindOneAndUpdate(Bazaar_model, { _id: delitem._id }, { isdelete: true, status: false });
  if (del_hd) {
    this.get_bazaars(req, res, next);
  } else {
    res.json({ status: false, data: "server error" });
    return next();
  }
}

exports.gamelink = async (req, res, next) => {
  var updata = req.body.data;
  var lastdata = await BASECONTROL.BfindOneAndUpdate(Bazaar_model, { _id: updata._id }, updata);
  if (lastdata) {
    this.get_bazaars(req, res, next);
  } else {
    res.json({ status: false, data: "we can't find this item" });
    return next();
  }
}

exports.getgames = async (req, res, next) => {
  var gamesData = await BASECONTROL.BSortfind(GameModel, { isdelete: false }, { _id: 1 });
  if (gamesData) {
    res.send({ status: true, data: gamesData });
    return next();
  } else {
    res.send({ status: false, data: "server error" });
    return next();
  }
}

exports.update_games = async (req, res, next) => {
  var data = req.body.data;
  var ud_db = await BASECONTROL.BfindOneAndUpdate(GameModel, { _id: data._id }, data);
  if (ud_db) {
    this.getgames(req, res, next);
  } else {
    res.send({ status: false, data: "server error" });
    return next();
  }
}

exports.delete_games = async (req, res, next) => {
  var data = req.body.data;
  var dt_hd = await BASECONTROL.BfindOneAndUpdate(GameModel, { _id: data._id }, { isdelete: true });
  if (dt_hd) {
    this.getgames(req, res, next);
  } else {
    res.send({ status: false, data: "server error" });
    return next();
  }
}

exports.create_games = async (req, res, next) => {

  var data = req.body.data;
  var ct_hd = await BASECONTROL.data_save(data, GameModel);
  if (ct_hd) {
    this.getgames(req, res, next);
  } else {
    res.send({ status: false, data: "server error" });
    return next();
  }
}

exports.upload_imgs = async (req, res, next) => {

  let { imagesrc, _id } = req.body;
  if (imagesrc) {
    let item = await GameModel.findOne({ _id: _id });
    if (item) {
      if (item.image && item.image.length) {
        var del_path = config.BASEURL + item.image;
        fs.unlink(del_path, async (err) => {
        });
      }
      let up = await GameModel.findOneAndUpdate({ _id: _id }, { image: imagesrc });
      if (up) {
        this.getgames(req, res, next);
      } else {
        return res.json({
          status: false,
          data: "fail"
        });
      }
    } else {
      return res.json({
        status: false,
        data: "fail"
      });
    }
  } else {
    return res.json({
      status: false,
      data: "fail"
    });
  }
}

exports.restricChecking = async (bazarid, date) => {
  let today = moment(date).format('YYYY-MM-DD');
  let isCheck = await SattaresstrictionDays.findOne({ bazaarid: mongoose.Types.ObjectId(bazarid), RestrictionDate: { $regex: today } });
  if (isCheck) {
    return true
  } else {
    return false
  }
}

exports.firstpageBazars = async (req, res, next) => {
  let bazaarsData = await BazarTypeModel.find({ status: true })

  // let bazaarsData1 = await Bazaar_model.findOne({status : true, isdelete : false,  bazaartype :  "1"}).sort({_id : 1}).limit(1);
  // let bazaarsData2 = await Bazaar_model.findOne({status : true, isdelete : false,  bazaartype :  "2"}).sort({_id : 1}).limit(1);
  // let bazaarsData3 = await Bazaar_model.findOne({status : true, isdelete : false,  bazaartype :  "3"}).sort({_id : 1}).limit(1);
  // let bazaarsData = []
  // bazaarsData.push(bazaarsData1)
  // bazaarsData.push(bazaarsData2)
  // bazaarsData.push(bazaarsData3)
  const BazaartypesKey = {
    "607c425e9b104a5ac1cc23ac": "1",
    "607c433db684df5e57e633b0": "2",
    "607c43cf35cbab6036dd501c": "3"
  }

  let dating = new Date();
  var start = BASECONTROL.get_stand_date_first(dating);
  var end = BASECONTROL.get_stand_date_end1(dating);
  let rows = [];
  for (let i in bazaarsData) {

    let bazaarsData1 = await Bazaar_model.findOne({ status: true, isdelete: false, bazaartype: BazaartypesKey[bazaarsData[i]._id] }).sort({ _id: 1 }).limit(1);
    if (bazaarsData1) {
      let item = Object.assign({}, bazaarsData1._doc, { icon: bazaarsData[i].icon1, name: bazaarsData[i].name })

      var reitem = await BASECONTROL.BfindOne(Result_model, { bazaarid: bazaarsData1._id, resultdate: { $gte: start, $lte: end } });
      if (reitem) {
        if (BazaartypesKey[bazaarsData[i]._id] == "1") {
          var row = Object.assign({}, item, { result: reitem._doc.openresult + " - " + reitem._doc.jodiresult + " - " + reitem._doc.closeresult }, { bool: "1" });
        } else if (BazaartypesKey[bazaarsData[i]._id] == "2") {
          var row = Object.assign({}, item, { result: reitem._doc.jodiresult }, { bool: "2" });
        } else {
          var row = Object.assign({}, item, { result: "- - -" }, { bool: "3" });
        }

        rows.push(row);
      } else {
        rows.push(item)
      }
    }
  }

  res.send({
    status: true, data: rows
  })
}

exports.RefreshResult = async (req, res, next) => {
  let { data } = req.body;
  let dating = new Date();
  var start = BASECONTROL.get_stand_date_first(dating);
  var end = BASECONTROL.get_stand_date_end1(dating);
  var reitem = await BASECONTROL.BfindOne(Result_model, { bazaarid: data._id, resultdate: { $gte: start, $lte: end } });
  if (reitem) {

    let item = data

    if (item['bool'] == "1") {
      var row = Object.assign({}, item, { result: reitem._doc.openresult + " - " + reitem._doc.jodiresult + " - " + reitem._doc.closeresult });
    } else if (item['bool'] == "2") {
      var row = Object.assign({}, item, { result: reitem._doc.openresult + " - " + reitem._doc.jodiresult });
    } else {
      var row = Object.assign({}, item, { result: "- - -" });
    }

    res.send({
      status: true, data: row
    })

  } else {
    res.send({
      status: false, data: ""
    })
  }

}

exports.load_bazaars = async (req, res, next) => {


  let { date } = req.body;

  // let isCheck = await resstrictionDays.findOne({ type : "matka",RestrictionDate : {  $regex :today}});
  // if (!isCheck) {
  let dating = new Date();
  let andquery = { status: true, isdelete: false };
  if (date && date) {
    dating = new Date(date);
  }


  let week = dating.getDay();
  andquery[("week." + week)] = true;

  let requery = { status: true, isdelete: false }
  requery['bazaartype.1'] = true
  let kiquery = { status: true, isdelete: false }
  kiquery['bazaartype.2'] = true
  let stquery = { status: true, isdelete: false }
  stquery['bazaartype.3'] = true

  let regamelist = await BASECONTROL.BSortfind(GameModel, requery, { _id: 1 });
  let kigamelist = await BASECONTROL.BSortfind(GameModel, kiquery, { _id: 1 });
  let stgamelist = await BASECONTROL.BSortfind(GameModel, stquery, { _id: 1 });

  let gamesData = {};
  gamesData['1'] = regamelist
  gamesData['2'] = kigamelist
  gamesData['3'] = stgamelist

  var bazaarsData = await BASECONTROL.Bfind(Bazaar_model, andquery);

  var start = BASECONTROL.get_stand_date_first(dating)
  var end = BASECONTROL.get_stand_date_end1(dating)
  var bettingdate = BASECONTROL.get_stand_date_first(dating)
  var rows = [];
  let bazaObject = {};

  for (var i in bazaarsData) {

    let dd = await this.restricChecking(bazaarsData[i]._id, dating);
    if (!dd) {
      let b = BASECONTROL.BazarTimeCheck(bazaarsData[i].timers.opentime, 120)
      bazaObject[bazaarsData[i]._id] = bazaarsData[i];
      if (bazaarsData[i].bazaartype == StringKey.starline) {
        var reitem = null
        reitem = await Result_model.find({ bazaarid: bazaarsData[i]._id, resultdate: { $gte: start, $lte: end } })
        if (reitem) {
          let Objectrow = {};
          for (let j in reitem) {
            Objectrow[reitem[j].startLinetimer] = reitem[j].openresult + "-" + reitem[j].jodiresult;
          }
          var row = Object.assign({}, bazaarsData[i]._doc, { result: Objectrow }, { bettingdate });
          rows.push(row);
        } else {
          rows.push(Object.assign({}, bazaarsData[i]._doc, { bettingdate }))
        }
      } else {
        var reitem = null
        reitem = await Result_model.findOne({ bazaarid: bazaarsData[i]._id, resultdate: { $gte: start, $lte: end } })
        if (reitem) {
          var row = Object.assign({}, bazaarsData[i]._doc, { result: reitem._doc }, { bettingdate });
          rows.push(row);
        } else {
          rows.push(Object.assign({}, bazaarsData[i]._doc, { bettingdate }))
        }
      }

    }
  }

  for (var i = 0; i < rows.length - 1; i++) {
    for (var j = i + 1; j < rows.length; j++) {
      if (compare(rows[i], rows[j])) {
        let temp = rows[i];
        rows[i] = rows[j];
        rows[j] = temp;
      }
    }
  }

  function compare(a, b) {
    let t = a.timers.opentime.split(":")[0];
    let tt = a.timers.opentime.split(":")[1];
    let t1 = b.timers.opentime.split(":")[0];
    let tt1 = b.timers.opentime.split(":")[1];
    if ((parseInt(t * 60) + parseInt(tt)) > (parseInt(t1 * 60) + parseInt(tt1))) {
      return true
    } else {
      return false
    }
  }

  var bazartypes = await BASECONTROL.BSortfind(BazarTypeModel, { isdelete: false, status: true }, { _id: 1 });

  var numbersData = await BASECONTROL.Bfind(NumbersModel, {});
  res.json({ status: true, data: { gamedata: gamesData, bazaarsdata: rows, numbersdata: numbersData, bazaObject: bazaObject, bazartypes: bazartypes } });
  return next();

  // } else {
  //   res.json({status : false,data : isCheck.comment});
  //   return next();
  // }
}

exports.betPlaceTimerChecking = (bazarItem, gameid, time_flag, bettingdate) => {

  let type = bazarItem.bazaartype;
  let flag = false;
  let flag1 = false
  let flag2 = false
  switch (type) {
    case StringKey.regular:

      if (GameStringKeyId.Jodi == gameid || GameStringKeyId["full sangam"] == gameid || GameStringKeyId["half sangam"] == gameid) {
        flag1 = this.SavetimerChecking(bazarItem, bazarItem.timers.opentime, bettingdate)
        flag2 = this.SavetimerChecking(bazarItem, bazarItem.timers.closetime, bettingdate);
        if (flag1 && flag2) {
          flag = true
        } else {
          flag = false
        }
      } else {
        if (time_flag == "1") {
          flag = this.SavetimerChecking(bazarItem, bazarItem.timers.opentime, bettingdate);
        } else {
          flag = this.SavetimerChecking(bazarItem, bazarItem.timers.closetime, bettingdate);
        }
      }
      break;
    case StringKey["king-bazaar"]:

      flag = this.SavetimerChecking(bazarItem, bazarItem.timers.opentime, bettingdate);
      break;
    case StringKey.starline:

      // flag1 = this.SavetimerChecking(bazarItem,bazarItem.timers.closetime,bettingdate);
      flag2 = this.Bettimerchecking3(bazarItem, time_flag, bettingdate);
      if (flag2) {
        // if (flag1 && flag2) {
        flag = true
      } else {
        flag = false
      }
      break;
  }
  return flag;
}

exports.Bettimerchecking3 = (bazarItem, time, bettingdate) => {

  let tt = 0;
  let times = time.split(":");
  if (time.indexOf("PM") === -1) {
    tt = parseInt(times[0]);
  } else {
    tt = parseInt(times[0]) + 12;
  }

  let opentime = tt + ":" + times[1]

  let flag = this.SavetimerChecking(bazarItem, opentime, bettingdate);
  return flag
}

exports.SavetimerChecking = (bazaaritem, opentimeclosetime, bettingdate, opencloseflag, opentime) => {

  let isch = this.checkRemaningTime(opentimeclosetime, bettingdate, opencloseflag, opentime)
  if (isch) {
    let rMin = isch / 1000 / 60;
    if (rMin < bazaaritem.blocktime) {
      return false
    } else {
      return true
    }
  } else {
    return false
  }
}

exports.checkRemaningTime = (date, bettingdate, opencloseflag, opentime) => {
  let server = new Date().getTime();
  let dddd = new Date(bettingdate).getTime();
  let times = date.split(":");
  let mms = (parseInt(times[0]) * 3600 * 1000 + parseInt(times[1]) * 60 * 1000) + dddd - 5 * 3600 * 1000 - 30 * 60 * 1000;

  if (opencloseflag) {
    let opentimeH = parseInt(opentime.split(":")[0]);
    if (opentimeH > parseInt(times[0])) {
      mms += 24 * 3600 * 1000
    }
  }

  let remain = mms - server;
  if (remain < 1) {
    return false
  } else {
    return remain
  }
}

exports.save_bet_bazaars = async (req, res, next) => {


  // let { bettingdate } = req.body;
  let ipaddress = BASECONTROL.get_ipaddress(req)

  var p_item = await BASECONTROL.BfindOne(GamePlay, { id: req.user._id });
  if (p_item) {
    var betsdata = req.body.data;
    let totalamount = await Usercontrol.getsattaExposure(p_item.userid)
    for (let i in betsdata) {
      totalamount += parseInt(betsdata[i].amount)
    }
    let exposurelimit = p_item.sattalimit

    if (totalamount > exposurelimit) {
      res.json({ status: false, data: "Exposure Limit Exceeded " });
      return next();
    }
    var user = req.user;

    var transactionid = req.body.transactionid;
    // var lastbet = await BASECONTROL.BfindOne(BetS_models,{transactionid : transactionid});
    // if(!lastbet){

    // var rows=[];

    let bazaObject = {};
    var bazaarsData = await BASECONTROL.Bfind(Bazaar_model, { status: true, isdelete: false });

    for (let i in bazaarsData) {
      bazaObject[bazaarsData[i]._id] = bazaarsData[i];
    }
    let reject = 0;

    for (let i in betsdata) {


      let item = betsdata[i];
      let id = (betsdata[i].id).split(":");
      let bazaarid = id[0];
      let gameid = id[1];
      let time_flag = item.time_flag;
      let bazarItem = bazaObject[bazaarid];
      if (bazarItem && bazarItem.bazaartype.length) {
        let IsCheck = this.betPlaceTimerChecking(bazarItem, gameid, time_flag, item.bettingdate);
        let today = moment(item.bettingdate).format('YYYY-MM-DD');

        if (IsCheck) {
          let row = {};
          row = {
            betnumber: item.betnumber,
            amount: item.amount,
            roundid: item.roundid,
            transactionid: item.transactionid,
            status: StatusKey.pending,
            time_flag: item.time_flag,
            bazaarid: mongoose.Types.ObjectId(id[0]),
            gameid: mongoose.Types.ObjectId(id[1]),
            userid: mongoose.Types.ObjectId(user._id),
            detail: item.detail,
            type: bazarItem.bazaartype,
            name: item.name,
            winamount: item.winamount,
            DATE: BASECONTROL.IndiatimeFromTime(today),
            betacept: false
          }

          let betitem = new BetS_models(row);

          let wallets_ = {
            commission: 0,
            status: "BET",
            roundid: row.roundid,
            transactionid: transactionid,
            userid: mongoose.Types.ObjectId(user._id),
            credited: 0,
            debited: row.amount,
            lastbalance: p_item.balance,
            bazaarid: mongoose.Types.ObjectId(row.bazaarid),
            matkabetid: betitem._id,
            ipaddress
          }

          var sa_hd = await BASECONTROL.BSave(betitem);
          var up_db = await BASECONTROL.email_balanceupdate(user.email, item.amount * -1, wallets_);
          if (!sa_hd || up_db === false) {
            res.json({ status: false, data: "fail" });
            return next();
          }
        } else {
          reject++;
        }

      }

    }

    let message = "";
    if (reject) {
      message = "success , It is rejected " + reject + " of items Because time out.";
    } else {
      message = "success";
    }

    res.json({ status: true, data: message });
    return next();
    // } else {
    //   res.json({status : false,data : "fail"});
    //   return next();
    // }
  } else {
    res.json({ status: false, data: "fail" });
    return next();
  }

}

exports.adminGetLoadBazaars = async (req, res, next) => {

  const date = req.body.date;
  if (!date) {
    res.send({ status: false, data: "error" });
    return next()
  }

  const start = BASECONTROL.get_stand_date_end(date);
  const end = BASECONTROL.get_stand_date_end1(date);


  const gameList = await GameModel.find({ status: true, isdelete: false });
  const bazarList = await Bazaar_model.find({ status: true, isdelete: false });


  let betsObject = {
    "1": {},
    "2": {},
    "3": {}
  };
  let bazarListObject = {

  }

  let totalwallet = {
    amount: 0,
    count: 0,
    profit: 0,
  }

  for (var i in bazarList) {

    let bazaritem = bazarList[i];
    let type = bazaritem.bazaartype; // bazartype  You can see in sconfig

    bazarListObject[bazaritem._id] = bazarList[i];

    let resString = "- - -";
    let result = false;
    // let reitem = await Result_model.findOne({bazaarid : bazaritem._id});

    if (bazaritem.bazaartype == StringKey.starline) {
      var reitems = await BASECONTROL.Bfind(Result_model, { "resultdate": { $gte: start, $lte: end }, bazaarid: bazaritem._id });
      if (reitems.length) {
        resString = {};
        for (let j in reitems) {
          resString[reitems[j].startLinetimer] = reitems[j].openresult + "-" + reitems[j].jodiresult;
        }
      }

    } else {
      var reitem = await BASECONTROL.BfindOne(Result_model, { "resultdate": { $gte: start, $lte: end }, bazaarid: bazaritem._id });
      if (reitem) {
        result = true
        resString = reitem.openresult + "-" + reitem.jodiresult + "-" + reitem.closeresult;
      }
    }

    let betdata = await BetS_models.aggregate([
      {
        $match: {
          $and: [
            {
              bazaarid: mongoose.Types.ObjectId(bazaritem._id),
              "DATE": { $gte: start, $lte: end }
            }
          ]
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

    let usercount = await BetS_models.aggregate([
      {
        $match: {
          $and: [
            {
              bazaarid: mongoose.Types.ObjectId(bazaritem._id),
              "DATE": { $gte: start, $lte: end }
            }
          ]
        }
      },
      {
        $group: {
          "_id": "$userid",
        }
      },
    ])

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
        result: resString,
        usercount: usercount.length
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
        result: resString,
        usercount: usercount.length
      }
    }
  }



  let ROW = {
    'regular': {
      "No of Bets": 0,
      "Total Amount of Bets": 0,
      "PNL": 0,
    },
    "king-bazaar": {
      "No of Bets": 0,
      "Total Amount of Bets": 0,
      "PNL": 0,
    },
    'starline': {
      "No of Bets": 0,
      "Total Amount of Bets": 0,
      "PNL": 0,
    },
    'total': {
      "No of Bets": 0,
      "Total Amount of Bets": 0,
      "PNL": 0,
    },
  }

  andquery = [{ "DATE": { $gte: start, $lte: end } }];

  let array = await BetS_models.aggregate([
    {
      $match:
      {
        $and: andquery,
      },
    },
    {
      $group:
      {
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
      "$group":
      {
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

        wallet[item] = item == StatusKey.win ? winam : betam;

        StatusKey.pending == item ? wallet.count = betscount : ""
        StatusKey.pending == item ? wallet.amt = betam : ""

      }

      wallet["GGR"] = wallet.bet - wallet.win - wallet.rollback;

      ROW['total']["PNL"] += wallet["GGR"]
      ROW['total']['Total Amount of Bets'] += wallet["bet"]
      ROW['total']['No of Bets'] += wallet["count"]

      wallet['bazarname'] = KeyString[array[i]._id];

      // row = Object.assign(row,wallet);

      ROW[KeyString[array[i]._id]]['No of Bets'] = wallet.count;
      ROW[KeyString[array[i]._id]]['PNL'] = wallet["GGR"];
      ROW[KeyString[array[i]._id]]['Total Amount of Bets'] = wallet["amt"];

      // newrows.push(row)
    }

  }



  res.json({ status: true, data: { betsObject, bazarListObject, totalwallet, gameList, totals: ROW } });
  return next();
}

exports.get_odds_amount = async (bitemid, gitemid) => {
  var dd = await BASECONTROL.BfindOne(Bazaar_model, { _id: bitemid });
  var gg = dd.gamelink[gitemid];
  let oddamount = 1;
  if (gg) {
    oddamount = gg.oddsprice;
  }
  return oddamount
}

exports.get_renuve_frombazzar = async (req, res, next) => {
  const { resultdate, bazaarid, jodiresult, closeresult, openresult } = req.body.data;
  var start = BASECONTROL.get_stand_date_first(resultdate);
  var end = BASECONTROL.get_stand_date_end1(resultdate);
  var totalbet = 0;
  var totalwin = 0;
  var totalloose = 0;

  await BetS_models.aggregate([
    { $match: { $and: [{ "DATE": { $gte: start } }, { "DATE": { $lte: end } }, { bazaarid: bazaarid }, { betnumber: jodiresult }] } },
    { $group: { _id: { "bazaarid": "$bazaarid", }, AMOUNT: { $sum: '$amount' }, COUNT: { $sum: 1 }, } },
  ]).then(rdata => {
    if (rdata.length > 0) {
      totalwin = rdata[0].AMOUNT;
    }
  });

  await BetS_models.aggregate([
    { $match: { $and: [{ "DATE": { $gte: start } }, { "DATE": { $lte: end } }, { bazaarid: bazaarid }, { betnumber: openresult }, { time_flag: "1" }] } },
    { $group: { _id: { "bazaarid": "$bazaarid", }, AMOUNT: { $sum: '$amount' }, COUNT: { $sum: 1 }, } },
  ]).then(rdata => {
    if (rdata.length > 0) {
      totalwin += rdata[0].AMOUNT;
    }
  });

  await BetS_models.aggregate([
    { $match: { $and: [{ "DATE": { $gte: start } }, { "DATE": { $lte: end } }, { bazaarid: bazaarid }, { betnumber: closeresult }, { time_flag: "2" }] } },
    { $group: { _id: { "bazaarid": "$bazaarid", }, AMOUNT: { $sum: '$amount' }, COUNT: { $sum: 1 }, } },
  ]).then(rdata => {
    if (rdata.length > 0) {
      totalwin += rdata[0].AMOUNT;
    }
  });

  await BetS_models.aggregate([
    { $match: { $and: [{ "DATE": { $gte: start } }, { "DATE": { $lte: end } }, { bazaarid: bazaarid }] } },
    {
      $group: {
        _id: {
          "bazaarid": "$bazaarid",
        },
        AMOUNT: { $sum: '$amount' },
        COUNT: { $sum: 1 },
      }
    },
  ]).then(rdata => {
    if (rdata.length > 0) {
      totalbet = rdata[0].AMOUNT;
    }
  });

  totalloose = totalbet - totalwin;

  res.json({ status: true, data: { totalbet: totalbet, totalloose: totalloose, totalwin: totalwin } });
  return next();

}

exports.get_bets_from_resultannouncer = async (req, res, next) => {

  var win_numbers = [];
  var date = req.body.date;
  var bazar = req.body.bazzarItem;
  var gamelist = req.body.gamesdata;

  if (date && bazar && gamelist) {

    let type = bazar.bazaartype;
    switch (type) {
      case StringKey.regular:
        win_numbers = await this.getWiningNumberFromRegular(date, bazar, gamelist);
        break;
      case StringKey["king-bazaar"]:
        win_numbers = await this.getWiningNumberFromKing(date, bazar, gamelist);
        break;
      case StringKey.starline:
        win_numbers = await this.getWiningNumberFromStartLine(date, bazar, gamelist);
        break;
    }

    res.json({ status: true, data: win_numbers });
    return next();

  } else {
    res.json({ status: false, data: 'error' });
    return next();
  }
}

exports.getWiningNumberFromRegular = async (date, bazar, gamelist) => {
  var start = BASECONTROL.get_stand_date_first(date);
  var end = BASECONTROL.get_stand_date_end1(date);

  var rows = [];
  var items = [];
  var dd = await BASECONTROL.Bfind(NumbersModel, { $or: [{ bool: "3" }, { bool: "4" }, { bool: "5" }] });

  for (let i in dd) {
    let item1 = dd[i].gamenumbers;
    for (let j in item1) {
      if (item1[j].length > 3) {
        for (let k in item1[j]) {
          rows.push(item1[j][k]);
        }
      } else {
        rows.push(item1[j]);
      }
    }
  }

  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < rows.length; j++) {
      items.push(rows[i] + "-" + get_jodi(rows[i], rows[j]) + "-" + rows[j]);
    }
  }

  let tcount = rows.length;
  let caseNumbers = [];

  for (let i = 0; i < 50; i++) {

    let r_index = getRndInteger(1, tcount - 1);
    let row = items[r_index].split("-");

    let openresult = row[0].toString();
    let jodiresult = row[1].toString();
    let closeresult = row[2].toString();
    let opensignleank = jodiresult[0].toString();
    let closesignleandk = jodiresult[1].toString();


    let cc0 = await BetS_models.aggregate([
      {
        $match: {
          $and: [{ "DATE": { $gte: start, $lte: end }, bazaarid: mongoose.Types.ObjectId(bazar._id), status: StatusKey.pending }],
          $or: [
            { betnumber: openresult }, { betnumber: jodiresult },
            { betnumber: closeresult }, { betnumber: opensignleank }, { betnumber: closesignleandk }
          ]
        }
      },
      {
        $group: {
          "_id": "$bazaarid",
          AMOUNT: { $sum: '$amount' },
        }
      }
    ]);

    if (cc0.length) {
      caseNumbers.push({ amount: cc0[0].AMOUNT, "result": items[r_index] });
    } else {
      caseNumbers.push({ amount: 0, "result": items[r_index], });
    }
  }


  caseNumbers.sort(function (a, b) {
    return parseInt(a.amount) - parseInt(b.amount);
  });
  ////////////////// each case Numbers getting


  let cc1 = await BetS_models.aggregate([
    {
      $match: {
        $and: [{ "DATE": { $gte: start, $lte: end }, bazaarid: mongoose.Types.ObjectId(bazar._id), time_flag: "1", status: StatusKey.pending }]
      }
    },
    {
      $group: {
        "_id": "$gameid",
        AMOUNT: { $sum: '$amount' },
      }
    }
  ]);

  let keygameObject = {};
  if (cc1.length) {
    for (let i in cc1) {
      keygameObject[cc1[i]._id] = cc1[i].AMOUNT;
    }
  }

  let topNumbers = [];

  for (let i = 0; i < 20; i++) {

    let row = {};
    row = { "result": caseNumbers[i]['result'] };

    let total = 0;
    let result = caseNumbers[i]['result'].split("-");
    let openresult = result[0].toString();
    let jodiresult = result[1].toString();
    let closeresult = result[2].toString();
    let opensignleank = jodiresult[0].toString();
    let closesignleandk = jodiresult[1].toString();

    for (var j in gamelist) {

      let profit = keygameObject[gamelist[j]._id] ? keygameObject[gamelist[j]._id] : 0;

      let bet = await BetS_models.aggregate([
        {
          $match: {
            $and: [{ "DATE": { $gte: start, $lte: end }, bazaarid: mongoose.Types.ObjectId(bazar._id), status: StatusKey.pending, gameid: mongoose.Types.ObjectId(gamelist[j]._id) }],
            $or: [
              { betnumber: openresult }, { betnumber: jodiresult },
              { betnumber: closeresult }, { betnumber: opensignleank }, { betnumber: closesignleandk }
            ]
          },
        },
        {
          $group: {
            _id: "$gameid",
            AMOUNT: { $sum: '$amount' },
          }
        }
      ]);

      if (bet.length) {
        profit -= bet[0].AMOUNT;
      }

      row[gamelist[j]._id] = profit;
      total += profit;
    }

    row["totalprofit"] = total;

    topNumbers.push(row);
  }

  // above betting in games 


  return topNumbers

}

exports.getWiningNumberFromKing = async (date, bazar, gamelist) => {

  var start = BASECONTROL.get_stand_date_first(date);
  var end = BASECONTROL.get_stand_date_end1(date);

  var dd = await BASECONTROL.BfindOne(NumbersModel, { bool: "2" });
  if (dd) {
    let jodi = dd.gamenumbers;
    let rows = [];

    for (var i in jodi) {
      for (var j in jodi[i]) {


        let jodinum = (jodi[i][j]).toString();
        let fidinum = jodinum[0];
        let sedinum = jodinum[1];

        let cc0 = await BetS_models.aggregate([
          {
            $match: {
              $and: [{ "DATE": { $gte: start, $lte: end }, bazaarid: mongoose.Types.ObjectId(bazar._id), time_flag: "1", status: StatusKey.pending }],
              $or: [
                { betnumber: jodinum }, { betnumber: fidinum }, { betnumber: sedinum }
              ]
            }
          },
          {
            $group: {
              "_id": "$bazaarid",
              AMOUNT: { $sum: '$winamount' },
            }
          }
        ]);

        if (cc0.length) {
          rows.push({ amount: cc0[0].AMOUNT, "result": jodinum });
        } else {
          rows.push({ amount: 0, "result": jodinum });
        }
      }
    }

    // getting lost amount 

    rows.sort(function (a, b) {
      return parseInt(a.amount) - parseInt(b.amount);
    });

    /// above sorting part


    let cc1 = await BetS_models.aggregate([
      {
        $match: {
          $and: [{ "DATE": { $gte: start, $lte: end }, bazaarid: mongoose.Types.ObjectId(bazar._id), time_flag: "1", status: StatusKey.pending }]
        }
      },
      {
        $group: {
          "_id": "$gameid",
          AMOUNT: { $sum: '$amount' },
        }
      }
    ]);

    let keygameObject = {};
    if (cc1.length) {
      for (let i in cc1) {
        keygameObject[cc1[i]._id] = cc1[i].AMOUNT;
      }
    }

    // above betting in games 

    let topNumbers = [];

    for (let i = 0; i < 20; i++) {

      let result = (rows[i].result).toString();
      let jodi = result;
      let fidigit = result[0]
      let sedigit = result[1];

      let row = {};
      row = { "result": result };
      let total = 0;
      for (var j in gamelist) {

        let profit = keygameObject[gamelist[j]._id] ? keygameObject[gamelist[j]._id] : 0;

        let bet = await BetS_models.aggregate([
          {
            $match: {
              $and: [{ "DATE": { $gte: start, $lte: end }, bazaarid: mongoose.Types.ObjectId(bazar._id), time_flag: "1", status: StatusKey.pending, gameid: mongoose.Types.ObjectId(gamelist[j]._id) }],
              $or: [
                { betnumber: jodi }, { betnumber: fidigit }, { betnumber: sedigit }
              ]
            },
          },
          {
            $group: {
              _id: "$gameid",
              AMOUNT: { $sum: '$winamount' },
            }
          }
        ]);

        if (bet.length) {
          profit -= bet[0].AMOUNT;
        }

        row[gamelist[j]._id] = profit;
        total += profit;
      }

      row["totalprofit"] = total;

      topNumbers.push(row);
    }

    return topNumbers;
  } else {
    return []
  }

}

function gettingSingleAnk(openresult) {
  let open = 0;
  let singleAnk = 0;
  for (let j in openresult) {
    open += parseInt(openresult[j]);
  }
  singleAnk = (open % 10).toString();
  return singleAnk
}

function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function get_jodi(open, close) {
  let opens = 0;
  open += "";
  for (let i in open) {
    opens += parseInt(open[i]);
  }
  let closes = 0;
  close += "";
  for (let i in close) {
    closes += parseInt(close[i])
  }
  return (opens % 10) + "" + (closes % 10);
}

exports.get_date = (time) => {
  var times = time.split(":");
  if (times.length >= 1) {
    let time = ""
    if (parseInt(times[0]) > 12) {
      time = convert((parseInt(times[0]) - 12)) + ":" + convert(times[1]) + " PM";
      return time;
    } else if (parseInt(times[0]) === 12) {
      time = "12:" + convert(times[1]) + " PM";
      return time
    } else if (parseInt(times[0]) === 0) {
      time = "12:" + convert(times[1]) + "  AM";
      return time
    } else {
      time = convert(parseInt(times[0])) + ":" + convert(times[1]) + "  AM";
      return time
    }
  }
  function convert(number) {
    if (parseInt(number) > 9) {
      return number
    } else {
      return "0" + parseInt(number)
    }
  }
}

exports.StartLinebazarget_options = (timers) => {

  // var closetime = parseInt((timers.closetime).split(":")[0]);
  // var opentime = parseInt(timers.opentime.split(":")[0]);
  // var lasttime = timers.opentime.split(":")[1];
  // var options = [];
  // for (var i = opentime ; i <= closetime ; i++) {
  // 	let item = this.get_date(i + ":" + lasttime);
  // 	options.push(item);
  // } 
  // return options;
  let stepmin = parseInt(parseFloat(timers.interval) * 60);
  stepmin = stepmin > 0 ? stepmin : 60
  var closetime = parseInt((timers.closetime).split(":")[0]);
  var opentime = parseInt(timers.opentime.split(":")[0]);
  var options = [];
  if (opentime > closetime) {
    closetime += 24;
  }

  let opentimemin = parseInt(timers.opentime.split(":")[1]) + opentime * 60;
  let closetimemin = parseInt(timers.closetime.split(":")[1]) + closetime * 60;

  for (let i = opentimemin; i <= closetimemin; i += stepmin) {
    let hhmm = gettimeHHMMFromMM(i)
    let hh = hhmm.h;
    let mm = hhmm.m;
    let tt = hh;
    if (hh > 23) {
      tt -= 24;
    }
    let item = get_date(tt + ":" + mm);
    options.push(item);
  }

  return options;
}

exports.getWiningNumberFromStartLine = async (date, bazar, gamelist) => {

  var rows = [];

  var start = BASECONTROL.get_stand_date_first(date);
  var end = BASECONTROL.get_stand_date_end1(date);

  var dd = await BASECONTROL.Bfind(NumbersModel, { $or: [{ bool: "3" }, { bool: "4" }, { bool: "5" }] });
  for (let i in dd) {
    let item1 = dd[i].gamenumbers;
    for (let j in item1) {
      if (item1[j].length > 3) {
        for (let k in item1[j]) {
          rows.push(item1[j][k]);
        }
      } else {
        rows.push(item1[j]);
      }
    }
  }

  let tcount = rows.length;
  let caseNumbers = [];

  let timeroptions = this.StartLinebazarget_options(bazar.timers);


  for (let i = 0; i < 50; i++) {
    let index = getRndInteger(1, tcount - 1);
    let tindex = getRndInteger(1, timeroptions.length - 1);
    let openresult = (rows[index]).toString();
    let singleAnk = gettingSingleAnk(openresult);
    let timerflag = timeroptions[tindex];

    let cc0 = await BetS_models.aggregate([
      {
        $match: {
          $and: [{ "DATE": { $gte: start, $lte: end }, bazaarid: mongoose.Types.ObjectId(bazar._id), time_flag: timerflag, status: StatusKey.pending }],
          $or: [
            { betnumber: openresult }, { betnumber: singleAnk }
          ]
        }
      },
      {
        $group: {
          "_id": "$bazaarid",
          AMOUNT: { $sum: '$winamount' },
        }
      }
    ]);

    if (cc0.length) {
      caseNumbers.push({ amount: cc0[0].AMOUNT, "result": openresult, timerflag: timerflag });
    } else {
      caseNumbers.push({ amount: 0, "result": openresult, timerflag: timerflag });
    }
  }


  caseNumbers.sort(function (a, b) {
    return parseInt(a.amount) - parseInt(b.amount);
  });
  ////////////////// each case Numbers getting

  let cc1 = await BetS_models.aggregate([
    {
      $match: {
        $and: [{ "DATE": { $gte: start, $lte: end }, bazaarid: mongoose.Types.ObjectId(bazar._id), status: StatusKey.pending }]
      }
    },
    {
      $group: {
        "_id": "$gameid",
        AMOUNT: { $sum: '$amount' },
      }
    }
  ]);

  let keygameObject = {};
  if (cc1.length) {
    for (let i in cc1) {
      keygameObject[cc1[i]._id] = cc1[i].AMOUNT;
    }
  }

  let topNumbers = [];

  for (let i = 0; i < 20; i++) {

    let openresult = (caseNumbers[i].result).toString();
    let singleAnk = gettingSingleAnk(openresult);
    let timerflag = caseNumbers[i].timerflag

    let row = {};
    row = { "result": timerflag + " : " + openresult + "-" + singleAnk };
    let total = 0;
    for (var j in gamelist) {

      let profit = keygameObject[gamelist[j]._id] ? keygameObject[gamelist[j]._id] : 0;

      let bet = await BetS_models.aggregate([
        {
          $match: {
            $and: [{ "DATE": { $gte: start, $lte: end }, time_flag: timerflag, bazaarid: mongoose.Types.ObjectId(bazar._id), status: StatusKey.pending, gameid: mongoose.Types.ObjectId(gamelist[j]._id) }],
            $or: [
              { betnumber: openresult }, { betnumber: singleAnk }
            ]
          },
        },
        {
          $group: {
            _id: "$gameid",
            AMOUNT: { $sum: '$winamount' },
          }
        }
      ]);

      if (bet.length) {
        profit -= bet[0].AMOUNT;
      }

      row[gamelist[j]._id] = profit;
      total += profit;
    }

    row["totalprofit"] = total;

    topNumbers.push(row);
  }

  // above betting in games 



  return topNumbers;
}

function get_numbers() {

  var single = [];
  for (var i = 0; i < 10; i++) {
    single.push(i + '');
  }
  var jodi = {};
  let mod = 0;
  for (var i = 0; i < 100; i++) {
    // jodi.push( i < 10 ? ("0"+ i) : i + "");
    if ((i % 10) == 0) {
      mod = i / 10
      jodi[mod] = [];
      jodi[mod].push(i < 10 ? ("0" + i) : i + "");
    } else {
      jodi[mod].push(i < 10 ? ("0" + i) : i + "");
    }
  }


  var singlepana = {};
  var tripplepana = ["000"];
  var doublepana = {};
  for (var i = 100; i < 1000; i++) {
    let num = (i + "").split("");
    for (let j in num) {
      num[j] = num[j] == 0 ? parseInt("1" + num[j]) : parseInt(num[j]);
    }
    if (num[0] <= num[1] && num[1] <= num[2]) {
      if (num[0] != num[1] && num[0] != num[2] && num[1] != num[2]) {
        let sum = 0;
        for (let j in num) {
          sum += (num[j]);
        }
        let mod = sum % 10;
        if (singlepana[mod]) {
          singlepana[mod].push(i);
        } else {
          singlepana[mod] = [i];
        }
      } else if (num[0] == num[1] && num[1] == num[2]) {
        tripplepana.push(i);
      } else if (num[0] == num[1] || num[1] == num[2]) {
        let sum = 0;
        for (let j in num) {
          sum += (num[j]);
        }
        let mod = sum % 10;
        if (doublepana[mod]) {
          doublepana[mod].push(i);
        } else {
          doublepana[mod] = [i];
        }
      }
    }

  }

  var row = [];
  row.push({ bool: 1, gamenumbers: single })
  row.push({ bool: 2, gamenumbers: jodi })
  row.push({ bool: 3, gamenumbers: singlepana })
  row.push({ bool: 4, gamenumbers: tripplepana })
  row.push({ bool: 5, gamenumbers: doublepana });
  // NumbersModel.insertMany(row).then(rdata =>{
  // });
}

exports.Loadresstrictiondays = async (req, res, next) => {
  let params = req.body.params;
  if (params) {
    let array = [];
    let pages = {};
    let totalcount = await SattaresstrictionDays.countDocuments();
    pages = reportsControl.setpage(params, totalcount);
    if (totalcount > 0) {
      array = await SattaresstrictionDays.find().skip(pages.skip).limit(pages.params.perPage).populate("bazaarid");
    }
    pages = reportsControl.setpage(params, 0);

    let options = await Bazaar_model.aggregate([
      {
        $match: {
          $and: [{ status: true, isdelete: false }]
        }
      },
      {
        $project: {
          value: "$_id",
          label: "$bazaarname",
        }
      }
    ])

    pages["skip2"] = (pages.skip) + array.length;
    res.send({
      status: true, data: array,
      pageset: pages,
      options: options
    });
    return next();

  } else {
    res.send({ status: false, data: "error" });
    return next();
  }
}

exports.Saveresstrictiondays = async (req, res, next) => {
  let row = req.body.row;

  let item = {
    comment: row.comment,
    RestrictionDate: moment(new Date(row.RestrictionDate)).format('YYYY-MM-DD'),
    bazaarid: mongoose.Types.ObjectId(row.bazaarid)
  }

  let lastitem = await BASECONTROL.BfindOne(SattaresstrictionDays, { RestrictionDate: item.RestrictionDate, bazaarid: item.bazaarid });
  if (lastitem) {
    res.send({ status: false, data: "already exist" });
    return next();
  } else {
    let sh = await BASECONTROL.data_save(item, SattaresstrictionDays);
    if (sh) {
      this.Loadresstrictiondays(req, res, next);
    } else {
      res.send({ status: false, data: "error" });
      return next();
    }
  }
}

exports.Updateresstrictiondays = async (req, res, next) => {
  let row = req.body.row;
  if (row) {
    let paymentData = {
      comment: row.comment,
      RestrictionDate: moment(new Date(row.RestrictionDate)).format('YYYY-MM-DD'),
      bazaarid: mongoose.Types.ObjectId(row.bazaarid)
    }
    let up = await BASECONTROL.BfindOneAndUpdate(SattaresstrictionDays, { _id: row._id }, paymentData);
    if (up) {
      this.Loadresstrictiondays(req, res, next);
    } else {
      res.send({ status: false, data: "error" });
      return next();
    }
  } else {
    res.send({ status: false, data: "error" });
    return next();
  }
}

exports.deleteresstrictiondays = async (req, res, next) => {
  let data = req.body.row;
  if (data) {
    let Dhan = await BASECONTROL.BfindOneAndDelete(SattaresstrictionDays, { _id: data._id });
    if (Dhan) {
      this.Loadresstrictiondays(req, res, next);
    } else {
      res.send({ status: false, data: "error" });
      return next();
    }

  } else {
    res.send({ status: false, data: "error" });
    return next();
  }
}

exports.revenCalc = async (req, res, next) => {
  let { row } = req.body;
  if (row) {
    var start = BASECONTROL.get_stand_date_first(row.filters.date);
    var end = BASECONTROL.get_stand_date_end1(row.filters.date);

    let bazarItem = await Bazaar_model.findOne({ _id: mongoose.Types.ObjectId(row.bazaarid) });
    if (bazarItem) {
      let datas = [];
      var gamesData = await BASECONTROL.BSortfind(GameModel, { status: true, isdelete: false }, { _id: 1 });
      let gameobj = {};
      for (let i in gamesData) {
        gameobj[gamesData[i]._id] = gamesData[i];
      }
      let type = bazarItem.bazaartype;
      let date = row.filters.date;
      switch (type) {
        case StringKey.regular:
          datas = await this.regularRevenuCalc(row, bazarItem, start, end, gameobj)
          break;
        case StringKey["king-bazaar"]:
          datas = await this.KingRevenuCalc(row, bazarItem, start, end, gameobj)
          break;
        case StringKey.starline:
          datas = await this.startlineRevenuCalc(row, bazarItem, start, end, gameobj)
          break;
      }
      res.json({ status: true, data: datas })
      return next()
    } else {
      res.json({ status: false })
    }

  }
}

exports.regularRevenuCalc = async (row, bazarItem, start, end, gameobj) => {


  let { bazaarid, openresult, jodiresult, closeresult } = row;
  let Array = [];
  let Obj = {};
  Obj[GameStringKeyId['single ank']] = {
    NoOfWinusers: 0,
    PROFIT: 0,
    result: "",
    name: "single ank"
  };
  Obj[GameStringKeyId['Jodi']] = {
    NoOfWinusers: 0,
    PROFIT: 0,
    result: "",
    name: "Jodi"
  };
  Obj[GameStringKeyId['single pana']] = {
    NoOfWinusers: 0,
    PROFIT: 0,
    result: "",
    name: "single pana"
  };
  Obj[GameStringKeyId['double pana']] = {
    NoOfWinusers: 0,
    PROFIT: 0,
    result: "",
    name: "double pana"
  };
  Obj[GameStringKeyId['tripple pana']] = {
    NoOfWinusers: 0,
    PROFIT: 0,
    result: "",
    name: "tripple pana"
  };
  Obj[GameStringKeyId['half sangam']] = {
    NoOfWinusers: 0,
    PROFIT: 0,
    result: "",
    name: "half sangam"
  };
  Obj[GameStringKeyId['full sangam']] = {
    NoOfWinusers: 0,
    PROFIT: 0,
    result: "",
    name: "full sangam"
  };

  var singleAnkOpen = ''
  var singleAnkClose = ''


  if (bazarItem) {
    if (closeresult && closeresult.length) {
      singleAnkOpen = jodiresult.toString()[0];
      singleAnkClose = jodiresult.toString()[1]
      await open();
      await close();
    } else if (openresult && openresult.length) {
      singleAnkOpen = jodiresult.toString();
      await open();
    } else {
      return []
    }

    let totalcount = 0;
    let totalAmt = 0;

    for (let i in Obj) {

      totalcount += Obj[i].NoOfWinusers;
      totalAmt += Obj[i].PROFIT;
      Array.push(Obj[i])

    }

    let ObjTotal = {}
    ObjTotal['result'] = "-";
    ObjTotal['NoOfWinusers'] = totalcount;
    ObjTotal['PROFIT'] = totalAmt;
    ObjTotal['name'] = "Total";
    Array.push(ObjTotal)

    return Array;
  } else {
    return []
  }


  async function open() {

    let SAWinUsers = await BetS_models.aggregate([
      {
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
    ]);

    let SALostUsers = await BetS_models.aggregate([
      {
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
    ]);

    Obj[GameStringKeyId['single ank']].NoOfWinusers += getAMT(SAWinUsers).count;
    Obj[GameStringKeyId['single ank']].PROFIT += getAMT(SALostUsers).amt - getAMT(SAWinUsers).amt;
    Obj[GameStringKeyId['single ank']].result = singleAnkOpen;
    // open single Ank Win users

    let SpWinUsers = await BetS_models.aggregate([{
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
    ]);

    let SpLostUsers = await BetS_models.aggregate([{
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
    ]);


    Obj[GameStringKeyId['single pana']].NoOfWinusers += getAMT(SpWinUsers).count;
    Obj[GameStringKeyId['single pana']].PROFIT += getAMT(SpLostUsers).amt - getAMT(SpWinUsers).amt;
    Obj[GameStringKeyId['single pana']].result = openresult

    // open single Pana Win users

    let DpWinUsers = await BetS_models.aggregate([
      {
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
    ]);

    let DpLostUsers = await BetS_models.aggregate([
      {
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
    ]);
    // open Double Pana Win users

    Obj[GameStringKeyId['double pana']].NoOfWinusers += getAMT(DpWinUsers).count;
    Obj[GameStringKeyId['double pana']].PROFIT += getAMT(DpLostUsers).amt - getAMT(DpWinUsers).amt;
    Obj[GameStringKeyId['double pana']].result = openresult

    let TpWinUsers = await BetS_models.aggregate([
      {
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

    let TpLostUsers = await BetS_models.aggregate([
      {
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

    Obj[GameStringKeyId['tripple pana']].NoOfWinusers += getAMT(TpWinUsers).count;
    Obj[GameStringKeyId['tripple pana']].PROFIT += getAMT(TpLostUsers).amt - getAMT(TpWinUsers).amt;
    Obj[GameStringKeyId['tripple pana']].result = openresult
    // open Tripple Pana Win users
    return true
  }

  async function close() {
    let closestatus = StatusKey.pending
    let SAWinUsers = await BetS_models.aggregate([
      {
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
    ]);

    let SALostUsers = await BetS_models.aggregate([
      {
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
    ]);

    Obj[GameStringKeyId['single ank']].NoOfWinusers += getAMT(SAWinUsers).count;
    Obj[GameStringKeyId['single ank']].PROFIT += getAMT(SALostUsers).amt - getAMT(SAWinUsers).amt;
    Obj[GameStringKeyId['single ank']].result += " , " + singleAnkClose

    // close single Ank Win users

    let JDWinUsers = await BetS_models.aggregate([
      {
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
    ]);

    let JDLostUsers = await BetS_models.aggregate([
      {
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
    ]);


    Obj[GameStringKeyId['Jodi']].NoOfWinusers += getAMT(JDWinUsers).count;
    Obj[GameStringKeyId['Jodi']].PROFIT += getAMT(JDLostUsers).amt - getAMT(JDWinUsers).amt;
    Obj[GameStringKeyId['Jodi']].result = jodiresult
    // close single Ank Win users

    let SpWinUsers = await BetS_models.aggregate([{
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
    }]);

    let SpLostUsers = await BetS_models.aggregate([{
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
    }]);

    Obj[GameStringKeyId['single pana']].NoOfWinusers += getAMT(SpWinUsers).count;
    Obj[GameStringKeyId['single pana']].PROFIT += getAMT(SpLostUsers).amt - getAMT(SpWinUsers).amt;
    Obj[GameStringKeyId['single pana']].result += " , " + closeresult
    // close single Pana Win users

    let DpWinUsers = await BetS_models.aggregate([{
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
    }]);
    let DpLostUsers = await BetS_models.aggregate([{
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
    }]);

    Obj[GameStringKeyId['double pana']].NoOfWinusers += getAMT(DpWinUsers).count;
    Obj[GameStringKeyId['double pana']].PROFIT += getAMT(DpLostUsers).amt - getAMT(DpWinUsers).amt;
    Obj[GameStringKeyId['double pana']].result += " , " + closeresult
    // close Double Pana Win users

    let TpWinUsers = await BetS_models.aggregate([{
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
    }]);

    let TpLostUsers = await BetS_models.aggregate([{
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
    }]);


    Obj[GameStringKeyId['tripple pana']].NoOfWinusers += getAMT(TpWinUsers).count;
    Obj[GameStringKeyId['tripple pana']].PROFIT += getAMT(TpLostUsers).amt - getAMT(TpWinUsers).amt;
    Obj[GameStringKeyId['tripple pana']].result += "," + closeresult
    // close Tripple Pana Win users

    let halfWinUsers = await BetS_models.aggregate([{
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
    }]);

    let halfLostUsers = await BetS_models.aggregate([{
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
    }]);


    Obj[GameStringKeyId['half sangam']].NoOfWinusers += getAMT(halfWinUsers).count
    Obj[GameStringKeyId['half sangam']].PROFIT += getAMT(halfLostUsers).amt - getAMT(halfWinUsers).amt;
    Obj[GameStringKeyId['half sangam']].result = openresult + "-" + singleAnkClose

    // open half  sangam Win users

    let closehalfWinUsers = await BetS_models.aggregate([{
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
    }]);

    let closehalfLostUsers = await BetS_models.aggregate([{
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
    }]);


    Obj[GameStringKeyId['half sangam']].NoOfWinusers += getAMT(closehalfWinUsers).count;
    Obj[GameStringKeyId['half sangam']].PROFIT += getAMT(closehalfLostUsers).amt - getAMT(closehalfWinUsers).amt;
    Obj[GameStringKeyId['half sangam']].result += "," + singleAnkOpen + "-" + closeresult

    // close half sangam Pana Win users

    let fullWinUsers = await BetS_models.aggregate([{
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
    }]);

    let fullLostUsers = await BetS_models.aggregate([{
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
    }]);

    Obj[GameStringKeyId['full sangam']].NoOfWinusers += getAMT(fullWinUsers).count;
    Obj[GameStringKeyId['full sangam']].PROFIT += getAMT(fullLostUsers).amt - getAMT(fullWinUsers).amt;
    Obj[GameStringKeyId['full sangam']].result = openresult + "," + closeresult

    return true
    //close full sangam Pana Win users
  }
  // return true

}

exports.KingRevenuCalc = async (row, bazarItem, start, end, gameobj) => {
  // let {bazaarid ,jodiresult } = row;
  const { bazaarid, jodiresult, } = row;

  if (jodiresult && jodiresult.length) {

  } else {
    return []
  }
  let firstDigit = jodiresult[0];
  let secondDigit = jodiresult[1];

  let Array = [];
  let totalcount = 0;
  let totalAmt = 0;



  let JDWinUsers = await BetS_models.aggregate(
    [
      {
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
    ]);

  let JDLostUsers = await BetS_models.aggregate(
    [
      {
        $match: {
          $and: [
            { DATE: { $gte: start, $lte: end } },
            { bazaarid: mongoose.Types.ObjectId(bazaarid) },
            { gameid: mongoose.Types.ObjectId(GameStringKeyId.Jodi) },
            // { betnumber : { $ne : jodiresult}},
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

  let ObjJodi = {}
  ObjJodi['result'] = jodiresult;
  ObjJodi['name'] = gameobj[GameStringKeyId.Jodi].name;
  ObjJodi['NoOfWinusers'] = getAMT(JDWinUsers).count;
  ObjJodi['PROFIT'] = getAMT(JDLostUsers).amt - getAMT(JDWinUsers).amt;
  totalcount += ObjJodi['NoOfWinusers']
  totalAmt += ObjJodi['PROFIT']

  Array.push(ObjJodi)

  // open jodi win users
  let FDWinUsers = await BetS_models.aggregate([
    {
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
  ]);


  let FDlostUsers = await BetS_models.aggregate([
    {
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
  ]);



  let Objfirst = {}
  Objfirst['result'] = firstDigit;
  Objfirst['NoOfWinusers'] = getAMT(FDWinUsers).count;
  Objfirst['PROFIT'] = getAMT(FDlostUsers).amt - getAMT(FDWinUsers).amt;
  Objfirst['name'] = gameobj[GameStringKeyId["first Digit"]].name;
  Array.push(Objfirst)

  totalcount += Objfirst['NoOfWinusers']
  totalAmt += Objfirst['PROFIT']

  // open first digit win users
  let SDWinUsers = await BetS_models.aggregate([
    {
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
  ]);

  let SDlostUsers = await BetS_models.aggregate([
    {
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
  ]);

  let Objsecond = {}
  Objsecond['result'] = secondDigit;
  Objsecond['NoOfWinusers'] = getAMT(SDWinUsers).count;
  Objsecond['PROFIT'] = getAMT(SDlostUsers).amt - getAMT(SDWinUsers).amt;
  Objsecond['name'] = gameobj[GameStringKeyId["second Digit"]].name;
  Array.push(Objsecond)
  // open second digit win users
  totalcount += Objsecond['NoOfWinusers']
  totalAmt += Objsecond['PROFIT']

  let ObjTotal = {}
  ObjTotal['result'] = "-";
  ObjTotal['NoOfWinusers'] = totalcount;
  ObjTotal['PROFIT'] = totalAmt;
  ObjTotal['name'] = "Total";
  Array.push(ObjTotal)


  return Array


}

function getAMT(rows) {
  let amt = 0;
  let count = 0;
  for (let i in rows) {
    amt += rows[i].AMOUNT;
    count += rows[i].COUNT;
  }
  return {
    amt: amt, count: count
  }
}

exports.startlineRevenuCalc = async (row, bazarItem, start, end, gameobj) => {
  let { bazaarid, jodiresult, openresult, startLinetimer } = row;
  if (openresult && openresult.toString().length && startLinetimer && startLinetimer.length && bazarItem) {

  } else {
    return []
  }


  let Array = [];
  let totalcount = 0;
  let totalAmt = 0;

  let SAWinUsers = await BetS_models.aggregate([
    {
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
  ]);


  let SALostUsers = await BetS_models.aggregate([
    {
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
  ]);

  //open single Ank Win users
  let Objsingle = {}
  Objsingle['result'] = jodiresult;
  Objsingle['NoOfWinusers'] = getAMT(SAWinUsers).count;
  Objsingle['PROFIT'] = getAMT(SALostUsers).amt - getAMT(SAWinUsers).amt;
  Objsingle['name'] = gameobj[GameStringKeyId["single ank"]].name;
  Array.push(Objsingle)
  totalcount += Objsingle['NoOfWinusers']
  totalAmt += Objsingle['PROFIT']

  let SPWinUsers = await BetS_models.aggregate([
    {
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
  ]);

  let SPLostUsers = await BetS_models.aggregate([
    {
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
  ]);
  // open single pana  Win users

  let ObjSinglePana = {}
  ObjSinglePana['result'] = jodiresult;
  ObjSinglePana['NoOfWinusers'] = getAMT(SPWinUsers).count;
  ObjSinglePana['PROFIT'] = getAMT(SPLostUsers).amt - getAMT(SPWinUsers).amt;
  ObjSinglePana['name'] = gameobj[GameStringKeyId["single pana"]].name;
  Array.push(ObjSinglePana)

  totalcount += ObjSinglePana['NoOfWinusers']
  totalAmt += ObjSinglePana['PROFIT']

  let DpWinUsers = await BetS_models.aggregate([
    {
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
  ]);

  let DpLostUsers = await BetS_models.aggregate([
    {
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
  ]);
  // open double pana  Win users


  let ObjDoublePana = {}
  ObjDoublePana['result'] = jodiresult;
  ObjDoublePana['NoOfWinusers'] = getAMT(DpWinUsers).count;
  ObjDoublePana['PROFIT'] = getAMT(DpLostUsers).amt - getAMT(DpWinUsers).amt;
  ObjDoublePana['name'] = gameobj[GameStringKeyId["double pana"]].name;
  Array.push(ObjDoublePana)
  totalcount += ObjDoublePana['NoOfWinusers']
  totalAmt += ObjDoublePana['PROFIT']
  let TPWinUsers = await BetS_models.aggregate([
    {
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
  ]);
  let TPLostUsers = await BetS_models.aggregate([
    {
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
  ]);

  let ObjTriple = {}
  ObjTriple['result'] = jodiresult;
  ObjTriple['NoOfWinusers'] = getAMT(TPWinUsers).count;
  ObjTriple['PROFIT'] = getAMT(TPLostUsers).amt - getAMT(TPWinUsers).amt;
  ObjTriple['name'] = gameobj[GameStringKeyId["tripple pana"]].name;

  totalcount += ObjTriple['NoOfWinusers']
  totalAmt += ObjTriple['PROFIT']

  let ObjTOtal = {}
  ObjTOtal['result'] = "-";
  ObjTOtal['NoOfWinusers'] = totalcount;
  ObjTOtal['PROFIT'] = totalAmt;
  ObjTOtal['name'] = "Total";
  Array.push(ObjTOtal)
  // open tripple pana  Win users

  return Array
}

exports.get_bazartypes = async (req, res, next) => {
  var gamesData = await BASECONTROL.BSortfind(BazarTypeModel, { isdelete: false }, { _id: 1 });
  if (gamesData) {
    res.send({ status: true, data: gamesData });
    return next();
  } else {
    res.send({ status: false, data: "server error" });
    return next();
  }
}

exports.Telegrambazartypes = async (req, res, next) => {
  var gamesData = await BASECONTROL.BSortfind(BazarTypeModel, { isdelete: false, status: true }, { _id: 1 });
  if (gamesData) {
    res.send({ status: true, data: gamesData });
    return next();
  } else {
    res.send({ status: false, data: "server error" });
    return next();
  }
}

exports.update_bazartypes = async (req, res, next) => {
  var data = req.body.data;
  var ud_db = await BASECONTROL.BfindOneAndUpdate(BazarTypeModel, { _id: data._id }, data);
  if (ud_db) {
    this.get_bazartypes(req, res, next);
  } else {
    res.send({ status: false, data: "server error" });
    return next();
  }
}

exports.delete_bazartypes = async (req, res, next) => {
  var data = req.body.data;
  var dt_hd = await BASECONTROL.BfindOneAndUpdate(BazarTypeModel, { _id: data._id }, { isdelete: true });
  if (dt_hd) {
    this.get_bazartypes(req, res, next);
  } else {
    res.send({ status: false, data: "server error" });
    return next();
  }
}

exports.create_bazartypes = async (req, res, next) => {

  var data = req.body.data;
  var ct_hd = await BASECONTROL.data_save(data, BazarTypeModel);
  if (ct_hd) {
    this.get_bazartypes(req, res, next);
  } else {
    res.send({ status: false, data: "server error" });
    return next();
  }
}

exports.imgupload_bazartypes = async (req, res, next) => {
  let { imagesrc, _id } = req.body;

  if (imagesrc) {
    let item = await BazarTypeModel.findOne({ _id: _id });
    if (item) {
      if (item.image && item.image.length) {
        var del_path = config.BASEURL + item.image;
        fs.unlink(del_path, async (err) => {
        });
      }
      let up = await BazarTypeModel.findOneAndUpdate({ _id: _id }, { image: imagesrc });
      if (up) {
        this.get_bazartypes(req, res, next);
      } else {
        return res.json({
          status: false,
          data: "fail"
        });
      }
    } else {
      return res.json({
        status: false,
        data: "fail"
      });
    }
  } else {
    return res.json({
      status: false,
      data: "fail"
    });
  }
}

exports.icon1upload_bazartypes = async (req, res, next) => {
  let { imagesrc, _id } = req.body;

  if (imagesrc) {
    let item = await BazarTypeModel.findOne({ _id: _id });
    if (item) {
      if (item.icon1 && item.icon1.length) {
        var del_path = config.BASEURL + item.icon1;
        fs.unlink(del_path, async (err) => {
        });
      }
      let up = await BazarTypeModel.findOneAndUpdate({ _id: _id }, { icon1: imagesrc });
      if (up) {
        this.get_bazartypes(req, res, next);
      } else {
        return res.json({
          status: false,
          data: "fail"
        });
      }
    } else {
      return res.json({
        status: false,
        data: "fail"
      });
    }
  } else {
    return res.json({
      status: false,
      data: "fail"
    });
  }
}

exports.iconupload_bazartypes = async (req, res, next) => {
  let { imagesrc, _id } = req.body;

  if (imagesrc) {
    let item = await BazarTypeModel.findOne({ _id: _id });
    if (item) {
      if (item.icon && item.icon.length) {
        var del_path = config.BASEURL + item.icon;
        fs.unlink(del_path, async (err) => {
        });
      }
      let up = await BazarTypeModel.findOneAndUpdate({ _id: _id }, { icon: imagesrc });
      if (up) {
        this.get_bazartypes(req, res, next);
      } else {
        return res.json({
          status: false,
          data: "fail"
        });
      }
    } else {
      return res.json({
        status: false,
        data: "fail"
      });
    }
  } else {
    return res.json({
      status: false,
      data: "fail"
    });
  }
}

exports.Sureget_options1 = (timers, bettingdate) => {

  let gettime1 = new Date(bettingdate).getTime();
  let today = moment(new Date()).format('YYYY-MM-DD');
  let gettime2 = new Date(today).getTime();
  var closetime = parseInt((timers.closetime).split(":")[0]);
  var opentime = parseInt(timers.opentime.split(":")[0]);
  var lasttime = timers.opentime.split(":")[1];
  let stepmin = parseInt(parseFloat(timers.interval) * 60);
  stepmin = stepmin > 0 ? stepmin : 60
  if (opentime > closetime) {
    closetime += 24;
  }

  let opentimemin = parseInt(timers.opentime.split(":")[1]) + opentime * 60;
  let closetimemin = parseInt(timers.closetime.split(":")[1]) + closetime * 60;


  var options = [];
  for (let i = opentimemin; i <= closetimemin; i += stepmin) {
    let hhmm = gettimeHHMMFromMM(i)
    let hh = hhmm.h;
    let mm = hhmm.m;
    if (hh > 23) {
      hh -= 24
    }

    let now = parseInt(new Date().toTimeString().slice(0, 2));
    if (gettime1 < gettime2) {
      // if (gettime1 > gettime2) {
      // let tt = hh;
      // if (hh > 23) {
      //   tt -= 24;
      // }
      let item = this.get_date(hh + ":" + mm);
      options.push(item);
    } else if (gettime1 === gettime2) {
      if (hh <= now) {
        // if (hh > 23) {
        //   let item = this.get_date(hh - 24 + ":" + mm);
        //   options.push(item);
        // } else {
        let item = this.get_date(hh + ":" + mm);
        options.push(item);
        // }
      }
    } else {
      break;
    }
  }
  return options;
}

exports.findbazaars = async (req, res, next) => {

  let { bazaritem } = req.body;
  let index = 0;
  let goalDate = ""
  let bool = true

  while (bool) {


    let date = moment(new Date(new Date().valueOf() + index * 3600 * 1000 * 24)).format("YYYY-MM-DD");

    if (StringKey["king-bazaar"] == bazaritem.bazaartype) {
      let flag = this.SavetimerChecking(bazaritem, bazaritem.timers.opentime, date);
      if (flag) {
        let result = await Result_model.findOne({ bazaarid: bazaritem._id, resultdate: { $gte: date } });
        if (!result) {
          goalDate = date
          bool = false;
          break;
        }
      } else {

      }
    } else if (StringKey.starline == bazaritem.bazaartype) {
      let { timerflag } = req.body;
      let options = this.Sureget_options(bazaritem.timers, date);

      if (options.indexOf(timerflag) != -1) {
        let result = await Result_model.findOne({ bazaarid: bazaritem._id, resultdate: { $gte: date }, startLinetimer: timerflag });
        if (!result) {
          goalDate = date
          bool = false
          break;
        }
      }

      if (!bool) {
        break;
      }

    } else if (StringKey.regular == bazaritem.bazaartype) {

      let flag1 = this.SavetimerChecking(bazaritem, bazaritem.timers.opentime, date)
      let flag2 = this.SavetimerChecking(bazaritem, bazaritem.timers.closetime, date, true, bazaritem.timers.opentime);
      if (flag1 && flag2) {

        goalDate = date
        bool = false;
        break;
      } else {

      }
    }

    index++

    if (index > 2) {
      goalDate = moment(new Date(new Date().valueOf() + index * 3600 * 1000 * 24)).format("YYYY-MM-DD");

      break;
    }
  }


  let date = goalDate;

  // let isCheck = await resstrictionDays.findOne({ type : "matka",RestrictionDate : {  $regex :today}});
  // if (!isCheck) {
  let dating = new Date();
  let andquery = { status: true, isdelete: false };
  if (date && date) {
    dating = new Date(date);
  }


  let week = dating.getDay();
  andquery[("week." + week)] = true;
  andquery["_id"] = bazaritem._id;

  let requery = { status: true, isdelete: false }
  requery['bazaartype.1'] = true
  let kiquery = { status: true, isdelete: false }
  kiquery['bazaartype.2'] = true
  let stquery = { status: true, isdelete: false }
  stquery['bazaartype.3'] = true



  var bazaarsData = await BASECONTROL.BfindOne(Bazaar_model, andquery);
  if (bazaarsData) {
    bazaarsData = bazaarsData._doc
    var start = BASECONTROL.get_stand_date_first(dating)
    var end = BASECONTROL.get_stand_date_end1(dating)
    var rows = null;

    // for (var i in bazaarsData) {

    let dd = await this.restricChecking(bazaarsData._id, dating);
    if (!dd) {
      if (bazaarsData.bazaartype == StringKey.starline) {
        var reitem = null
        reitem = await Result_model.find({ bazaarid: bazaarsData._id, resultdate: { $gte: start, $lte: end } })
        if (reitem) {
          let Objectrow = {};
          for (let j in reitem) {
            Objectrow[reitem[j].startLinetimer] = reitem[j].openresult + "-" + reitem[j].jodiresult;
          }
          var row = Object.assign({}, bazaarsData, { result: Objectrow }, { bettingdate: date });
          rows = row
        } else {
          rows = (Object.assign({}, bazaarsData, { bettingdate: date }))
        }
      } else {
        var reitem = null
        reitem = await Result_model.findOne({ bazaarid: bazaarsData._id, resultdate: { $gte: start, $lte: end } })
        if (reitem) {
          var row = Object.assign({}, bazaarsData, { result: reitem._doc }, { bettingdate: date });
          rows = (row);
        } else {
          rows = (Object.assign({}, bazaarsData, { bettingdate: date }))
        }
      }

    }
    // }

    res.send({
      status: true,
      data: goalDate,
      bazaritemdata: rows
    })
  } else {
    res.send({
      status: false,
    })
  }
}

exports.GetNewBazars = async (req, res, next) => {

  let d = await Matka6Control.AxiosRequest("https://cms.matka6.com/admin/matka6/checkingBazars", {});
  if (d.status) {

    let rows = d.data
    for (let i in rows) {
      let item = rows[i];

      await BASECONTROL.BfindOneAndUpdate(Bazaar_model, { _id: item._id }, item);

    }

    this.get_bazaars(req, res, next)
  } else {
    return res.json({
      status: false,
      data: "fail"
    });
  }

}

function getScrapematkaResult(callback) {
  const url = 'https://dpboss.net/';
  let results = []

  rp(url)
    .then(function (html) {

      const $ = cheerio.load(html);

      let items = $('.matka-result > .matka-card')[0].children;
      let rows = []

      for (let i = 0; i < items.length; i++) {

        let name = items[i].name;
        if (name) {
          let data = items[i].children[0].data
          switch (name) {
            case "h6":
              rows.push(data)
              break
            case "h5":
              rows.push(data)
              break
          }
        }
      }

      for (let i = 0; i < rows.length; i += 2) {
        results.push({ bazarname: rows[i], result: rows[i + 1] })
      }

      callback(results)
    })
    .catch(function (err) {
      callback([])
      //handle error
    });

}

function getScrapeSattaResult(callback) {
  const url = 'https://dpboss.net/';
  let rows = []

  rp(url)
    .then(function (html) {

      const $ = cheerio.load(html);

      let items = $('.satta-result > div');

      for (let i = 0; i < items.length; i++) {
        let row = {}
        for (let j = 0; j < items[i].children.length; j++) {
          let tagname = items[i].children[j].name
          if (tagname) {
            let data = items[i].children[j].children[0].data
            switch (tagname) {
              case "h4":
                row['bazarname'] = data
                break;
              case "h5":
                row['result'] = data
                break;
              case "h6":
                row['time'] = data
                break;
            }
          }
        }
        rows.push(row)
      }

      callback(rows)

    })
    .catch(function (err) {
      callback([])
      //handle error
    });
}

exports.ScrapingResult = async (req, res, next) => {
  getScrapematkaResult((matkadata) => {
    getScrapeSattaResult((sattadata) => {
      res.send({ matka: matkadata, satta: sattadata });
      return next()
    })
  })
}

