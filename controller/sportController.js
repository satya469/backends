const fs = require("fs");
const mongoose = require("mongoose");
const redis = require("redis");
const axios = require("axios");
const baseController = require("./basecontroller");
const ReportsControll = require("./reportcontroller");
const {
  sportsTypeList,
  sportsBet,
  sportsTemp,
  sportsSetting,
} = require("../models/sports_model");
const { GamePlay, sessionmodel } = require("../models/users_model");
const rdsconfig = require("../servers/db.json");
const config = require("../db");
const home = require("../servers/home.json");

const instance = axios.create();

const redisClient = redis.createClient({
  host: rdsconfig.host,
  auth_pass: rdsconfig.auth_pass,
  port: rdsconfig.port,
  db: rdsconfig.sportdb,
});
redisClient.on("error", function () {});

const sportsConfig = {
  SPORTID: "sportid",
  FINISHED: "Finished",
  SUSPENDED: "Suspended",
  LIVE: "Live",
  NOTSTARTED: "NotStarted",
  ALL: "All",
  SPORTS: "sports",
  TIMESTAMP: "timestamp",
  SOCKETIO: "socketio",
  MULTI: "MULTI",
  ODDSCHANGE: "OddsChange",
  BETSTOP: "BetStop",
  FIXTURECHANGE: "FixtureChange",
  BETSETTLEMENT: "BetSettlement",
  RecoveryEvent: "RecoveryEvent",
  mtsStatus: "mtsstatus",
};

const marketConfig = {
  21: "winner",
  5: "winner",
};

// These functions are for admin website ///////////////////////////////////////////
exports.getMinMax = async (req, res) => {
  // get Min and Max amount
  let data = await baseController.BfindOne(sportsSetting, { type: "minmax" });
  if (data) {
    return res.json({ status: true, data: data.data });
  } else {
    return res.json({ status: false, data: "Failure" });
  }
};

exports.setMinMax = async (req, res) => {
  // set Min and Max amount
  let data = req.body;
  let flag = await baseController.BfindOneAndUpdate(
    sportsSetting,
    { type: "minmax" },
    {
      type: "minmax",
      data: data,
    }
  );
  if (flag) {
    return res.json({ status: true });
  } else {
    return res.json({ status: false });
  }
};

exports.getAdminSportsList = async (req, res) => {
  // sports list by eventstatus
  let data = req.body;
  let query = [];
  redisClient.keys("*", async (err, keys) => {
    redisClient.mget(keys, async function (err, values) {
      if (values) {
        for (let i = 0; i < values.length; i++) {
          let oneMatch = JSON.parse(values[i]);
          if (oneMatch.EventStatus == data.EventStatus) {
            let index = query.findIndex(
              (item) => item.sport_id == oneMatch.sportid
            );
            if (index < 0) {
              query.push({ sport_id: oneMatch.sportid });
            }
          }
        }
        let list_data = [];
        if (query.length) {
          list_data = await sportsTypeList.aggregate([
            {
              $match: {
                $and: [
                  {
                    status: true,
                    $or: query,
                  },
                ],
              },
            },
            {
              $sort: {
                order: 1,
              },
            },
            {
              $project: {
                label: "$sport_name",
                value: "$sport_id",
              },
            },
          ]);
        }
        return res.json({ status: true, data: list_data });
      } else {
        return res.json({ status: true, data: [] });
      }
    });
  });
};

exports.getAdminSportData = async (req, res) => {
  //get matchs for admin website
  let { params, condition } = req.body;
  let cond_key = "*";
  if (condition.sport_id) {
    cond_key = `*_${condition.sport_id}`;
  }

  redisClient.keys(cond_key, async (err, keys) => {
    redisClient.mget(keys, async function (err, eventData) {
      if (eventData) {
        let returnData = [];
        for (let i = 0; i < eventData.length; i++) {
          let oneData = JSON.parse(eventData[i]);
          if (oneData.EventStatus == condition.EventStatus) {
            let eif = false,
              eil = false;
            let enf = false,
              enl = false;
            if (condition.event_id) {
              let uitem = oneData.event_id.toString();
              eif = uitem
                .toLowerCase()
                .startsWith(condition.event_id.toLowerCase());
              eil = uitem
                .toLowerCase()
                .includes(condition.event_id.toLowerCase());
            } else {
              eif = true;
              eil = true;
            }
            if (condition.event_name) {
              let uitem = oneData.event_name.toString();
              enf = uitem
                .toLowerCase()
                .startsWith(condition.event_name.toLowerCase());
              enl = uitem
                .toLowerCase()
                .includes(condition.event_name.toLowerCase());
            } else {
              enf = true;
              enl = true;
            }
            if (!enf && !enl) continue;
            if (!eif && !eil) continue;

            let tempdata = {
              event_id: oneData.event_id,
              event_name: oneData.event_name,
              ScheduledTime: oneData.ScheduledTime,
              permission: oneData.permission,
              proData: oneData.proData,
              market_len: oneData.market.length,
            };

            if (condition.status == true || condition.status == false) {
              if (oneData.permission == condition.status) {
                returnData.push(tempdata);
              }
            } else {
              returnData.push(tempdata);
            }
          }
        }
        let totalcount = returnData.length;
        let pages = ReportsControll.setpage(params, totalcount);
        let newData = returnData.slice(pages.skip, pages.limit);
        pages["skip2"] = pages.skip + newData.length;
        return res.json({ status: true, data: newData, pages });
      } else {
        return res.json({ status: false, data: [] });
      }
    });
  });
};

exports.setAdminMatchStatus = async (req, res) => {
  // set match's status
  let data = req.body;
  let me = this;
  redisClient.keys(`${data.row.event_id}_*`, (err, keys) => {
    redisClient.get(keys[0], (err, fetchData) => {
      if (fetchData) {
        fetchData = JSON.parse(fetchData);
        fetchData.permission = data.key;
        redisClient.set(keys[0], JSON.stringify(fetchData), (err) => {});
        return me.getAdminSportData(req, res);
      } else {
        return res.json({ status: false });
      }
    });
  });
};

exports.setAdminFeatureData = async (req, res) => {
  //add featured events for match
  let row = req.body.row;
  if (row) {
    redisClient.keys(`${row.event_id}_*`, async (err, keys) => {
      redisClient.get(keys[0], async function (err, values) {
        if (values) {
          let event = JSON.parse(values);
          event.isfeatured = true;
          redisClient.set(keys[0], JSON.stringify(event));
          return res.json({ status: true });
        } else {
          return res.json({ status: false });
        }
      });
    });
  } else {
    return res.json({ status: false, data: "Failure" });
  }
};

exports.getFeaturedDataAdmin = async (req, res) => {
  // get featured sports for admin
  return getFeaturedEvents(res);
};

exports.removeFeaturedDataAdmin = async (req, res) => {
  let row = req.body.row;
  if (row) {
    redisClient.keys(`${row.event_id}_*`, async (err, keys) => {
      redisClient.get(keys[0], async function (err, values) {
        if (values) {
          let event = JSON.parse(values);
          event.isfeatured = false;
          redisClient.set(keys[0], JSON.stringify(event));
          getFeaturedEvents(res);
        } else {
          return res.json({ status: false });
        }
      });
    });
  } else {
    return res.json({ status: false, data: "server error" });
  }
};

const getFeaturedEvents = (res) => {
  // get featured sports data
  redisClient.keys("*", async (err, keys) => {
    redisClient.mget(keys, async function (err, values) {
      if (values) {
        let items = [];
        for (let i in values) {
          let item = JSON.parse(values[i]);
          if (
            item.isfeatured &&
            (item.EventStatus == sportsConfig.LIVE ||
              item.EventStatus == sportsConfig.NOTSTARTED ||
              item.EventStatus == sportsConfig.SUSPENDED)
          ) {
            items.push(item);
          }
        }
        return res.json({ status: true, data: items });
      } else {
        return res.json({ status: false });
      }
    });
  });
};

exports.updateProDataOfMatch = async (req, res) => {
  // update prodata of match
  let data = req.body.data;
  let me = this;
  redisClient.keys(`${data.event_id}_*`, async (err, keys) => {
    redisClient.get(keys[0], async function (err, values) {
      if (values) {
        let event = JSON.parse(values);
        event.proData = data.proData;
        if (data.proData.status) {
          event.permission = false;
          if (
            data.proData.status == "Suspend" ||
            data.proData.status == "Cancel"
          ) {
            setRollbackBets(data.event_id, data.proData.status + " BET");
          }
        } else {
          event.permission = true;
        }
        redisClient.set(keys[0], JSON.stringify(event));
        return me.getAdminSportData(req, res);
      } else {
        return res.json({ status: false });
      }
    });
  });
};

const setRollbackBets = async (event_id, status) => {
  // rollback bet by admin
  let bets = await baseController.Bfind(sportsBet, {
    GAMEID: event_id,
    "betting.handleState": false,
  });
  for (let k = 0; k < bets.length; k++) {
    let bets_item = bets[k];
    let userData = await baseController.BfindOne(GamePlay, {
      id: bets_item.USERID,
    });
    if (bets_item.betting.betType.toLowerCase() === "single") {
      let sportsWallet = {
        commission: 0,
        sportid: mongoose.Types.ObjectId(bets_item.gameid),
        sportsData: {
          MatchName: bets_item.betting.MatchName,
          MarketName: bets_item.betting.MarketName,
          OutcomeName: bets_item.betting.OutcomeName,
        },
        status,
        userid: mongoose.Types.ObjectId(bets_item.USERID),
        roundid: bets_item.betting.transactionId,
        transactionid: bets_item.betting.transactionId,
        lastbalance: userData.balance,
        credited: bets_item.AMOUNT,
        debited: 0,
      };
      await baseController.player_balanceupdatein_Id(
        bets_item.AMOUNT,
        bets_item.USERID,
        sportsWallet
      );
      await sportsBet
        .updateOne(
          { _id: bets_item._id },
          {
            "betting.handleState": true,
            TYPE: status,
            "betting.resultMoney": bets_item.AMOUNT,
            "betting.lastbalance": userData.balance,
            "betting.afterbalance":
              Number(userData.balance) + Number(bets_item.AMOUNT),
          }
        )
        .then(async (err) => {});
    } else {
      let sportsWallet = {
        commission: 0,
        sportid: mongoose.Types.ObjectId(bets_item.gameid),
        sportsData: {
          MatchName: bets_item.betting.MatchName,
          MarketName: bets_item.betting.MarketName,
          OutcomeName: bets_item.betting.OutcomeName,
        },
        status,
        userid: mongoose.Types.ObjectId(bets_item.USERID),
        roundid: bets_item.betting.transactionId,
        transactionid: bets_item.betting.transactionId,
        lastbalance: userData.balance,
        credited: bets_item.AMOUNT,
        debited: 0,
      };
      await baseController.player_balanceupdatein_Id(
        parseFloat(bets_item.AMOUNT),
        bets_item.USERID,
        sportsWallet
      );
      await sportsBet
        .updateMany(
          { "betting.transactionId": bets_item.betting.transactionId },
          {
            "betting.handleState": true,
            TYPE: status,
            "betting.resultMoney": bets_item.AMOUNT,
            "betting.lastbalance": userData.balance,
            "betting.afterbalance":
              Number(userData.balance) + Number(bets_item.AMOUNT),
          }
        )
        .then(async (err) => {});
    }
  }
};

exports.getAllSportsType = async (req, res) => {
  // admin sports list cms
  let rdata = await baseController.BSortfind(sportsTypeList, {}, { order: 1 });
  if (rdata) {
    return res.json({ status: true, data: rdata });
  } else {
    return res.json({ status: false });
  }
};

exports.uploadsportsImage = async (req, res, next) => {
  // admin sportsbook image upload
  let { imagesrc, _id } = req.body;
  if (imagesrc) {
    let item = await sportsTypeList.findOne({ _id: _id });
    if (item) {
      if (item.image && item.image.length) {
        let del_path = config.BASEURL + item.image;
        fs.unlink(del_path, async (err) => {});
      }
      let up = await sportsTypeList.findOneAndUpdate(
        { _id: _id },
        { image: imagesrc }
      );
      if (up) {
        this.getAllSportsType(req, res, next);
      } else {
        return res.json({ status: false, data: "fail" });
      }
    } else {
      return res.json({ status: false, data: "fail" });
    }
  } else {
    return res.json({ status: false, data: "fail" });
  }
};

exports.sportsTypeUpdate = async (req, res) => {
  // update of sports type
  let indata = req.body.data;
  for (let i = 0; i < indata.length; i++) {
    delete indata[i]._id;
    let updatehandle = await baseController.BfindOneAndUpdate(
      sportsTypeList,
      { sport_id: indata[i].sport_id },
      indata[i]
    );
    if (!updatehandle) {
      return res.json({ status: false, data: "fail" });
    }
  }
  let findhandle = await baseController.BSortfind(
    sportsTypeList,
    {},
    { order: 1 }
  );
  if (!findhandle) {
    return res.json({ status: false, data: "fail" });
  } else {
    return res.json({ status: true, data: findhandle });
  }
};

exports.getMyMarketData = async (req, res) => {
  //
  let { parsedFilter, date } = req.body;
  let start = baseController.get_stand_date_first(date.start);
  let end = baseController.get_stand_date_end(date.end);

  let countBetList = await sportsBet.aggregate([
    {
      $match: {
        DATE: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: {
          GAMEID: "$GAMEID",
          gameid: "$gameid",
          matchTime: "$betting.matchTime",
          MatchName: "$betting.MatchName",
        },
      },
    },
  ]);

  let count = countBetList.length;
  let pages = await baseController.setPage(parsedFilter, count);

  let ddd = await sportsBet.aggregate([
    {
      $match: {
        DATE: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: {
          GAMEID: "$GAMEID",
          gameid: "$gameid",
          matchTime: "$betting.matchTime",
          MatchName: "$betting.MatchName",
        },
        betscount: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        "_id.matchTime": 1,
      },
    },
    {
      $limit: pages.limit,
    },
    {
      $skip: pages.skip,
    },
    {
      $lookup: {
        from: "sports_lists",
        localField: "_id.gameid",
        foreignField: "_id",
        as: "sport",
      },
    },
    {
      $unwind: "$sport",
    },
  ]);
  let rows = [];
  for (let i in ddd) {
    let plcount = await getbetcount(ddd[i]._id);
    ddd[i].plcount = plcount;
    rows.push(ddd[i]);
  }

  pages["skip1"] = rows.length ? pages.skip + 1 : 0;
  pages["skip2"] = pages.skip + rows.length;

  return res.json({
    status: true,
    data: {
      data: rows,
      pages,
    },
  });

  async function getbetcount(ids) {
    let ddd = await sportsBet.aggregate([
      {
        $match: {
          DATE: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $match: {
          GAMEID: ids.GAMEID,
          gameid: ids.gameid,
          "betting.matchTime": ids.matchTime,
          "betting.MatchName": ids.MatchName,
        },
      },
      {
        $group: {
          _id: "$USERID",
          count: {
            $sum: 1,
          },
        },
      },
    ]);
    return ddd.length;
  }
};

exports.selectedMatchAdmin = async (req, res) => {
  let data = req.body;
  redisClient.keys(`${data.id}_*`, (err, keys) => {
    redisClient.get(keys[0], async (err, fetchData) => {
      if (fetchData) {
        let rdata = JSON.parse(fetchData);
        rdata.ScheduledTime = await changeTime(rdata.ScheduledTime);
        return res.json({ status: true, data: rdata });
      } else {
        return res.json({ status: false, data: "Failure" });
      }
    });
  });
};

exports.getBetHistoryAdmin = async (req, res) => {
  let id = req.body.id;
  let ddd = await sportsBet.aggregate([
    {
      $match: {
        GAMEID: id,
      },
    },
    {
      $lookup: {
        from: "user_users",
        localField: "USERID",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: "$user",
    },
  ]);

  if (ddd) {
    return res.json({ status: true, data: ddd });
  } else {
    return res.json({ status: false, data: "Failure" });
  }
};

exports.getDashboardMarkets = async (req, res, next) => {
  let date = req.body.date;
  let start = baseController.get_stand_date_first(date.start);
  let end = baseController.get_stand_date_end(date.end);
  let totoalwallet = {
    "no Of matches": 0,
    "number of bets": 0,
    "amount of bets": 0,
    pnl: 0,
  };

  let matchesdata = await sportsBet.aggregate([
    {
      $match: {
        DATE: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: {
          gameid: "$gameid",
          GAMEID: "$GAMEID",
        },
      },
    },
  ]);

  totoalwallet["no Of matches"] = matchesdata.length;
  let betsacount = await sportsBet.countDocuments({
    DATE: { $gte: start, $lte: end },
  });
  totoalwallet["number of bets"] = betsacount;

  let totalamounts = await sportsBet.aggregate([
    {
      $match: {
        DATE: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: null,
        amount: {
          $sum: "$AMOUNT",
        },
      },
    },
  ]);

  if (totalamounts.length) {
    totoalwallet["amount of bets"] = totalamounts[0].amount;
  }

  let win = await sportsBet.aggregate([
    {
      $match: {
        DATE: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: "$TYPE",
        amount: {
          $sum: "$AMOUNT",
        },
        resultMoney: {
          $sum: "$betting.resultMoney",
        },
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  let row = {
    BET: 0,
    WIN: 0,
  };

  if (win.length) {
    for (let i in win) {
      if (win[i]._id == "BET") {
        row["BET"] += win[i].amount;
      } else if (win[i]._id != "LOST") {
        row["WIN"] += win[i].resultMoney;
      }
    }
  }
  totoalwallet.pnl = parseInt(row.WIN - row.BET);

  let ddd = await sportsBet.aggregate([
    {
      $match: {
        DATE: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $lookup: {
        from: "sports_lists",
        localField: "gameid",
        foreignField: "_id",
        as: "sport",
      },
    },
    {
      $unwind: "$sport",
    },
    {
      $group: {
        _id: {
          gameid: "$gameid",
          GAMEID: "$GAMEID",
        },
        data: {
          $push: {
            matchTime: "$betting.matchTime",
            MatchName: "$betting.MatchName",
            GAMEID: "$GAMEID",
            sportname: "$sport.sport_name",
          },
        },
        betscount: {
          $sum: 1,
        },
      },
    },
  ]);
  let rows = [];
  for (let i in ddd) {
    let plcount = await getplayercount(ddd[i]._id);
    rows.push(
      Object.assign(
        {},
        { data: ddd[i].data[0] },
        { betscount: ddd[i].betscount, plcount }
      )
    );
  }
  rows.sort(function (b, news) {
    return new Date(news.data.matchTime) - new Date(b.data.matchTime);
  });

  res.send({
    status: true,
    data: rows,
    totoalwallet,
  });
  return next();

  async function getplayercount(ids) {
    let ddd = await sportsBet.aggregate([
      {
        $match: {
          gameid: ids.gameid,
          GAMEID: ids.GAMEID,
          DATE: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: "$USERID",
          count: {
            $sum: 1,
          },
        },
      },
    ]);
    return ddd.length;
  }
};

exports.getBetshistoryload = async (req, res, next) => {
  let date = req.body.date;
  let params = req.body.parsedFilter;
  let datap = req.body.params;
  let start = baseController.get_stand_date_end(date.start);
  let end = baseController.get_stand_date_end(date.end);

  let count = await sportsBet.countDocuments({
    GAMEID: datap.id,
    DATE: {
      $gte: start,
      $lte: end,
    },
  });

  let pages = baseController.setPage(params, count);

  let array = await sportsBet
    .find({
      GAMEID: datap.id,
      DATE: {
        $gte: start,
        $lte: end,
      },
    })
    .populate("gameid")
    .skip(pages.skip)
    .limit(pages.params.perPage)
    .populate("USERID");
  let totoalwallet = {
    pnl: 0,
    "amount of bets": 0,
    "number of bets": 0,
  };
  totoalwallet["number of bets"] = count;
  let totalamounts = await sportsBet.aggregate([
    {
      $match: {
        GAMEID: datap.id,
        DATE: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: null,
        amount: {
          $sum: "$AMOUNT",
        },
      },
    },
  ]);

  if (totalamounts.length) {
    totoalwallet["amount of bets"] = totalamounts[0].amount;
  }

  let win = await sportsBet.aggregate([
    {
      $match: {
        DATE: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: "$TYPE",
        amount: {
          $sum: "$AMOUNT",
        },
        resultMoney: {
          $sum: "$betting.resultMoney",
        },
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  let row = {
    BET: 0,
    WIN: 0,
  };

  if (win.length) {
    for (let i in win) {
      if (win[i]._id == "BET") {
        row["BET"] += win[i].amount;
      } else if (win[i]._id != "LOST") {
        row["WIN"] += win[i].resultMoney;
      }
    }
  }
  totoalwallet.pnl = parseInt(row.WIN - row.BET);

  pages["skip2"] = pages.skip + array.length;
  res.send({
    status: true,
    data: array,
    pageset: pages,
    totoalwallet,
  });
  return next();
};

exports.cancelOneBet = async (req, res, next) => {
  let item = req.body.item;
  let betItem = await baseController.BfindOne(sportsBet, { _id: item._id });
  if (betItem) {
    let user = await baseController.BfindOne(GamePlay, { id: betItem.USERID });
    if (betItem.TYPE == "BET" || betItem.TYPE == "LOST") {
      let sportsWallet = {
        commission: 0,
        sportid: mongoose.Types.ObjectId(betItem.gameid),
        sportsData: {
          MatchName: betItem.betting.MatchName,
          MarketName: betItem.betting.MarketName,
          OutcomeName: betItem.betting.OutcomeName,
        },
        status: "CANCEL_BET",
        userid: mongoose.Types.ObjectId(betItem.USERID),
        roundid: new Date().valueOf(),
        transactionid: new Date().valueOf(),
        lastbalance: user.balance,
        credited: betItem.AMOUNT,
        debited: 0,
      };
      await baseController.BfindOneAndUpdate(
        sportsBet,
        { _id: item._id },
        {
          TYPE: "CANCEL_BET",
          "betting.handleState": true,
          "betting.resultMoney": betItem.AMOUNT,
          "betting.lastbalance": user.balance,
          "betting.afterbalance": Number(user.balance) + Number(betItem.AMOUNT),
        }
      );
      await baseController.email_balanceupdate(
        user.email,
        betItem.AMOUNT,
        sportsWallet
      );
    } else {
      let diffMoney = betItem.AMOUNT - betItem.betting.resultMoney;
      let sportsWallet = {
        commission: 0,
        sportid: mongoose.Types.ObjectId(betItem.gameid),
        sportsData: {
          MatchName: betItem.betting.MatchName,
          MarketName: betItem.betting.MarketName,
          OutcomeName: betItem.betting.OutcomeName,
        },
        status: "CANCEL_BET",
        userid: mongoose.Types.ObjectId(betItem.USERID),
        roundid: new Date().valueOf(),
        transactionid: new Date().valueOf(),
        lastbalance: user.balance,
      };
      if (diffMoney > 0) {
        sportsWallet.credited = diffMoney;
        sportsWallet.debited = 0;
      } else {
        sportsWallet.credited = 0;
        sportsWallet.debited = Math.abs(diffMoney);
      }
      await baseController.BfindOneAndUpdate(
        sportsBet,
        { _id: item._id },
        {
          TYPE: "CANCEL_BET",
          "betting.handleState": true,
          "betting.resultMoney": Math.abs(diffMoney),
          "betting.lastbalance": user.balance,
          "betting.afterbalance": Number(user.balance) + diffMoney,
        }
      );
      await baseController.email_balanceupdate(
        user.email,
        diffMoney,
        sportsWallet
      );
    }
    return this.getBetshistoryload(req, res, next);
  } else {
    return res.json({ status: false, data: "Failure" });
  }
};

exports.getSDKStatus = async (req, res) => {
  let data = await baseController.Bfind(sportsTemp, {});
  let rdata = {};

  let uofFlag = data.findIndex((it) => it.key == "RecoveryEvent");
  rdata.uof = data[uofFlag].produceStatus;

  let mtsFlag = data.findIndex((it) => it.key == "mts");
  if (mtsFlag > -1) {
    rdata.mts = data[mtsFlag].produceStatus;
  } else {
    rdata.mts = false;
  }

  let systemMts = data.findIndex((it) => it.key == "systemMts");
  if (systemMts > -1) {
    rdata.systemMts = data[systemMts].produceStatus;
  } else {
    rdata.systemMts = false;
  }

  return res.json({ status: true, data: rdata });
};

exports.updateMtsStatus = async (req, res) => {
  let data = req.body;
  let flag = await baseController.BfindOneAndUpdate(
    sportsTemp,
    { key: "systemMts" },
    { key: "systemMts", produceStatus: data.systemMts }
  );
  if (flag) {
    return this.getSDKStatus(req, res);
  } else {
    return res.json({ status: false });
  }
};

// These functions are for player website ///////////////////////////////////////////
exports.placeBetPlayer = async (req, res) => {
  // player place bet
  let ip = await baseController.get_ipaddress(req);
  let data = req.body;
  let userData = await baseController.BfindOne(GamePlay, { id: req.user._id });

  let exposureFlag = await checkBetExposureAmount(userData, data, req.user._id);
  if (!exposureFlag) {
    return res.json({ status: false, message: "exposure limit" });
  }

  let balanceFlag = await checkBalanceOfUser(userData, data.allAmount);
  if (!balanceFlag) {
    return res.json({ status: false, message: "balance is small." });
  }

  if (data.betType == sportsConfig.MULTI) {
    let transactionId = await baseController.get_timestamp();
    let saveData = data.bet[0];
    let sportsWallet = {
      commission: 0,
      sportid: mongoose.Types.ObjectId(saveData.gameid),
      sportsData: {
        MatchName: saveData.betting.MatchName,
        MarketName: saveData.betting.MarketName,
        OutcomeName: saveData.betting.OutcomeName,
      },
      status: "BET",
      userid: mongoose.Types.ObjectId(req.user._id),
      roundid: transactionId,
      transactionid: transactionId,
      lastbalance: userData.balance,
      credited: 0,
      debited: saveData.AMOUNT,
    };
    await baseController.player_balanceupdatein_Id(
      parseFloat(saveData.AMOUNT) * -1,
      req.user._id,
      sportsWallet
    );
    for (let i = 0; i < data.bet.length; i++) {
      let saveData = data.bet[i];
      saveData.USERID = mongoose.Types.ObjectId(req.user._id);
      saveData.TYPE = "BET";
      saveData.betting.betType = data.betType;
      saveData.betting.betId = data.betId;
      saveData.betting.prevbalance = userData.balance;
      saveData.betting.transactionId = transactionId;
      saveData.betting.gameid = saveData.gameid;
      saveData.betting.mtsId = transactionId;
      saveData.betting.mtsState = "pending";
      saveData.betting.mtsSent = true;
      saveData.betting.ip = ip;
      saveData.betting.channel = req.headers.device > 1000 ? 1 : 0;
      saveData.betting.handleState = false;
      saveData.betting.isVFHALFWIN = false;
      saveData.betting.isDHFTHIRDWIN = false;
      saveData.betting.isDHFHALFWIN = false;
      saveData.betting.isVFHALFLOST = false;
      saveData.betting.isVFALLLOST = false;

      saveData.betting.lastbalance = userData.balance;
      saveData.betting.afterbalance = userData.balance - saveData.AMOUNT;

      await baseController.data_save(saveData, sportsBet);
    }
    if (
      home.admindomain == "https://cms.fairbets.co" ||
      home.admindomain == "https://cms.rbet1.com" ||
      home.admindomain == "https://cms.starkasino.io"
    ) {
      let mtsData = {
        ip,
        userid: req.user._id,
        ticketid: transactionId,
        bets: [],
        channel: req.headers.device > 1000 ? 1 : 0,
        count: data.bet.length,
      };

      for (let i = 0; i < data.bet.length; i++) {
        let spec = data.bet[i].betting.MarketSpecifiers;
        spec = spec.split(",").join("&");
        spec = spec.split("=").join("|");
        spec = spec.split("+").join("*");
        let outcome_id = data.bet[i].betting.OutcomeId.split("+").join("*");

        mtsData.bets.push({
          stake: data.bet[i].AMOUNT * 10000,
          eventid: data.bet[i].GAMEID,
          product_id:
            data.bet[i].betting.sportid == 21
              ? 5
              : data.bet[i].betting.EventStatus == sportsConfig.LIVE
              ? 1
              : 3,
          sport_id: "sr:sport:" + data.bet[i].betting.sportid,
          market_id: data.bet[i].betting.MarketId,
          outcome_id: outcome_id,
          specifier: spec,
          odd: data.bet[i].betting.OutcomeOdds * 10000,
        });
      }
      instance
        .get(
          `http://127.0.0.1:8500/newticket?data=${JSON.stringify(
            mtsData
          )}&&&key=1`
        )
        .then(() => {})
        .catch((err) => {});
    } else {
      const io = req.app.get(sportsConfig.SOCKETIO);
      let sData = {
        status: "true",
        ticketId: transactionId,
      };
      this.mtsStatusChild(sData, io, res);
    }
  } else {
    for (let i = 0; i < data.bet.length; i++) {
      let tempTransactionId = await baseController.get_timestamp();
      let saveData = data.bet[i];
      saveData.USERID = mongoose.Types.ObjectId(req.user._id);
      saveData.TYPE = "BET";
      saveData.betting.betType = data.betType;
      saveData.betting.betId = data.betId;
      saveData.betting.prevbalance = userData.balance;
      saveData.betting.transactionId = tempTransactionId;
      saveData.betting.gameid = saveData.gameid;
      saveData.betting.mtsId = tempTransactionId;
      saveData.betting.mtsState = "pending";
      saveData.betting.mtsSent = true;
      saveData.betting.channel = req.headers.device > 1000 ? 1 : 0;
      saveData.betting.ip = ip;
      saveData.betting.handleState = false;
      saveData.betting.isVFHALFWIN = false;
      saveData.betting.isDHFTHIRDWIN = false;
      saveData.betting.isDHFHALFWIN = false;
      saveData.betting.isVFHALFLOST = false;
      saveData.betting.isVFALLLOST = false;

      let sportsWallet = {
        commission: 0,
        sportid: mongoose.Types.ObjectId(saveData.gameid),
        sportsData: {
          MatchName: saveData.betting.MatchName,
          MarketName: saveData.betting.MarketName,
          OutcomeName: saveData.betting.OutcomeName,
        },
        status: "BET",
        userid: mongoose.Types.ObjectId(req.user._id),
        roundid: saveData.betting.transactionId,
        transactionid: saveData.betting.transactionId,
        lastbalance: userData.balance,
        credited: 0,
        debited: saveData.AMOUNT,
      };
      await baseController.player_balanceupdatein_Id(
        parseFloat(saveData.AMOUNT) * -1,
        req.user._id,
        sportsWallet
      );
      saveData.betting.lastbalance = userData.balance;
      saveData.betting.afterbalance = userData.balance - saveData.AMOUNT;

      await baseController.data_save(saveData, sportsBet);

      if (
        home.admindomain == "https://cms.fairbets.co" ||
        home.admindomain == "https://cms.rbet1.com" ||
        home.admindomain == "https://cms.starkasino.io"
      ) {
        // console.log(1)
        let mtsData = {
          ip,
          userid: req.user._id,
          count: 1,
          ticketid: tempTransactionId,
          bets: [],
          channel: req.headers.device > 1000 ? 1 : 0,
        };

        let spec = data.bet[i].betting.MarketSpecifiers;
        spec = spec.split(",").join("&");
        spec = spec.split("=").join("|");
        spec = spec.split("+").join("*");

        let outcome_id = data.bet[i].betting.OutcomeId.split("+").join("*");

        mtsData.bets.push({
          stake: data.bet[i].AMOUNT * 10000,
          eventid: data.bet[i].GAMEID,
          product_id:
            data.bet[i].betting.sportid == 21
              ? 5
              : data.bet[i].betting.EventStatus == sportsConfig.LIVE
              ? 1
              : 3,
          sport_id: "sr:sport:" + data.bet[i].betting.sportid,
          market_id: data.bet[i].betting.MarketId,
          outcome_id: outcome_id,
          specifier: spec,
          odd: data.bet[i].betting.OutcomeOdds * 10000,
        });
        instance
          .get(
            `http://127.0.0.1:8500/newticket?data=${JSON.stringify(
              mtsData
            )}&&&key=1`
          )
          .then(() => {})
          .catch((err) => {});
      } else {
        // console.log(2)
        const io = req.app.get(sportsConfig.SOCKETIO);
        let sData = {
          status: "true",
          ticketId: tempTransactionId,
        };
        this.mtsStatusChild(sData, io, res);
      }
    }
  }
  return res.json({ status: true });
};

exports.mtsStatusChild = async (sData, io, res) => {
  if (sData) {
    let betData = await baseController.Bfind(sportsBet, {
      "betting.mtsId": Number(sData.ticketId),
    });
    if (betData && betData.length) {
      if (sData.status == "true") {
        await sportsBet.updateMany(
          { "betting.mtsId": Number(sData.ticketId) },
          { "betting.mtsState": "accept" }
        );
      } else {
        let amount = 0;
        if (betData[0].betting.betType == sportsConfig.MULTI) {
          amount = betData[0].AMOUNT;
        } else {
          for (let i = 0; i < betData.length; i++) {
            amount += Number(betData[i].AMOUNT);
          }
        }

        let playerData = await baseController.BfindOne(GamePlay, {
          id: betData[0].USERID,
        });

        let sportsWallet = {
          commission: 0,
          sportid: mongoose.Types.ObjectId(betData[0].betting.gameid),
          sportsData: {
            MatchName: betData[0].betting.MatchName,
            MarketName: betData[0].betting.MarketName,
            OutcomeName: betData[0].betting.OutcomeName,
          },
          status: "CANCEL",
          userid: mongoose.Types.ObjectId(betData[0].USERID),
          roundid: betData[0].betting.transactionId,
          transactionid: betData[0].betting.transactionId,
          lastbalance: playerData.balance,
          credited: amount,
          debited: 0,
        };
        let userData = await baseController.BfindOne(GamePlay, {
          id: betData[0].USERID,
        });
        await baseController.player_balanceupdatein_Id(
          amount,
          betData[0].USERID,
          sportsWallet
        );
        if (sData.iscancel) {
          await sportsBet.updateMany(
            { "betting.mtsId": Number(sData.ticketId) },
            {
              "betting.mtsState": "reject",
              "betting.handleState": true,
              "betting.iscancel": sData.iscancel,
              "betting.lastbalance": userData.balance,
              "betting.afterbalance": userData.balance + amount,
            }
          );
        } else {
          await sportsBet.updateMany(
            { "betting.mtsId": Number(sData.ticketId) },
            {
              "betting.mtsState": "reject",
              "betting.handleState": true,
              "betting.lastbalance": userData.balance,
              "betting.afterbalance": userData.balance + amount,
            }
          );
        }
      }

      let bethandleDatas = await baseController.Bfind(sportsBet, {
        "betting.transactionId": Number(betData[0].betting.transactionId),
      });
      let betAcceptStatus = true,
        accept = 0,
        reject = 0;
      for (let key in bethandleDatas) {
        if (bethandleDatas[key].betting.mtsState == "accept") {
          accept++;
        } else if (bethandleDatas[key].betting.mtsState == "reject") {
          reject++;
        } else if (bethandleDatas[key].betting.mtsState == "pending") {
          betAcceptStatus = false;
        }
      }
      let msg = "Success";
      if (betAcceptStatus) {
        let sessionUser = await baseController.BfindOne(sessionmodel, {
          id: mongoose.Types.ObjectId(betData[0].USERID),
        });
        if (bethandleDatas.length > 1) {
          if (reject) {
            msg = "This bet is rejected";
            io.sockets
              .in(sessionUser.socketid)
              .emit(sportsConfig.mtsStatus, { status: false, betData, msg });
          } else {
            io.sockets
              .in(sessionUser.socketid)
              .emit(sportsConfig.mtsStatus, { status: true, betData, msg });
          }
        } else {
          if (!accept) {
            msg = "This bet is rejected";
            io.sockets
              .in(sessionUser.socketid)
              .emit(sportsConfig.mtsStatus, { status: false, betData, msg });
          } else if (!reject) {
            io.sockets
              .in(sessionUser.socketid)
              .emit(sportsConfig.mtsStatus, { status: true, betData, msg });
          } else {
            msg = `${accept} bets are accepted and ${reject} bets are rejected`;
            io.sockets
              .in(sessionUser.socketid)
              .emit(sportsConfig.mtsStatus, { status: true, betData, msg });
          }
        }
      }
    } else {
      return;
    }
  } else {
    return;
  }
};

const checkBetExposureAmount = async (userData, data, userid) => {
  //exposure compare
  let exposure = 0;
  let d = await sportsBet.aggregate([
    {
      $match: {
        $and: [{ USERID: userid, "betting.handleState": false }],
      },
    },
    {
      $group: {
        _id: null,
        amount: { $sum: "$AMOUNT" },
      },
    },
  ]);
  if (d && d.length) {
    exposure = d[0].amount;
  }

  if (exposure + Number(data.allAmount) > userData.sportsbooklimit) {
    return false;
  } else {
    return true;
  }
};

const checkBalanceOfUser = async (userData, amount) => {
  // balance compare
  if (!userData || userData.balance < amount) {
    return false;
  } else {
    return true;
  }
};

exports.getFirstpageData_before = async (req, res) => {
  console.log("------here---------");
  redisClient.keys("*", async (err, keys) => {
    redisClient.mget(keys, async function (err, values) {
      let rdata = [];
      async function navCalcData(match) {
        let market = [],
          marketLen = 0,
          T1X2;
        if (marketConfig[match.sportid]) {
          T1X2 = match.market.findIndex(
            (item) =>
              item.MarketName.toLowerCase().indexOf(
                marketConfig[match.sportid]
              ) > -1
          );
        } else {
          T1X2 = match.market.findIndex(
            (item) => item.MarketName.toLowerCase() == "1x2"
          );
        }
        let THANDICAP = match.market.findIndex(
          (item) => item.MarketName.toLowerCase() == "handicap"
        );
        let TTOTAL = match.market.findIndex(
          (item) => item.MarketName.toLowerCase() == "total"
        );
        if (T1X2 > -1) {
          market.push(match.market[T1X2]);
        }
        if (THANDICAP > -1) {
          market.push(match.market[THANDICAP]);
        }
        if (TTOTAL > -1) {
          market.push(match.market[TTOTAL]);
        }

        for (let i = 0; i < match.market.length; i++) {
          if (match.market[i].MarketStatus == "Active") {
            for (let j = 0; j < match.market[i].Outcomes.length; j++) {
              if (match.market[i].Outcomes[j].OutcomeStatus) {
                marketLen++;
                break;
              }
            }
          }
        }

        match.marketLen = marketLen;
        match.market = market;
        match.ScheduledTime = await changeTime(match.ScheduledTime);
        rdata.push(match);
      }
      if (values) {
        for (let i = 0; i < values.length; i++) {
          let oneMatch = JSON.parse(values[i]);
          if (
            oneMatch.market &&
            oneMatch.market.length &&
            oneMatch.permission
          ) {
            let index = rdata.findIndex(
              (item) => item.sportid == oneMatch.sportid
            );
            if (index < 0) {
              await navCalcData(oneMatch);
            }
            if (rdata.length >= 3 || values.length - 1 == i) {
              return res.json({ status: true, data: rdata });
            }
          }
        }
      } else {
        return res.json({ status: true, data: [] });
      }
    });
  });
};

exports.getFirstpageData = async (req, res) => {
  async function getSportsListBackendChild(EventStatus, cb) {
    return new Promise(async function (resolve, reject) {
      redisClient.keys("*", async (err, keys) => {
        redisClient.mget(keys, async function (err, values) {
          if (values) {
            let list_data = [];
            for (let i = 0; i < values.length; i++) {
              let oneMatch = JSON.parse(values[i]);
              let index = list_data.findIndex(
                (item) => item.sport_id == oneMatch.sportid
              );
              if (index < 0) {
                let tempList = await baseController.BfindOne(sportsTypeList, {
                  status: true,
                  sport_id: oneMatch.sportid,
                });
                if (tempList) {
                  list_data.push(
                    Object.assign({}, tempList._doc, { count: 1 })
                  );
                }
              } else {
                list_data[index].count++;
              }
            }
            if (!list_data) {
              resolve([]);
            } else {
              list_data.sort(function (A, B) {
                return A.order < B.order ? -1 : 1;
              });
              resolve(list_data);
            }
          } else {
            resolve([]);
          }
        });
      });
    });
  }

  let values = await getSportsListBackendChild();
  let rdata = [];

  async function navCalcData(match) {
    let market = [],
      marketLen = 0,
      T1X2;
    if (marketConfig[match.sportid]) {
      T1X2 = match.market.findIndex(
        (item) =>
          item.MarketName.toLowerCase().indexOf(marketConfig[match.sportid]) >
          -1
      );
    } else {
      T1X2 = match.market.findIndex(
        (item) => item.MarketName.toLowerCase() == "1x2"
      );
    }
    let THANDICAP = match.market.findIndex(
      (item) => item.MarketName.toLowerCase() == "handicap"
    );
    let TTOTAL = match.market.findIndex(
      (item) => item.MarketName.toLowerCase() == "total"
    );
    if (T1X2 > -1) {
      market.push(match.market[T1X2]);
    }
    if (THANDICAP > -1) {
      market.push(match.market[THANDICAP]);
    }
    if (TTOTAL > -1) {
      market.push(match.market[TTOTAL]);
    }

    for (let i = 0; i < match.market.length; i++) {
      if (match.market[i].MarketStatus == "Active") {
        for (let j = 0; j < match.market[i].Outcomes.length; j++) {
          if (match.market[i].Outcomes[j].OutcomeStatus) {
            marketLen++;
            break;
          }
        }
      }
    }

    match.marketLen = marketLen;
    match.market = market;
    match.ScheduledTime = await changeTime(match.ScheduledTime);
    rdata.push(match);
  }

  if (values) {
    redisClient.keys("*", async (err, keys) => {
      redisClient.mget(keys, async function (err, matchs) {
        if (matchs) {
          for (let i = 0; i < 3; i++) {
            let oneList = values[i];
            for (let j = 0; j < matchs.length; j++) {
              let oneMatch = JSON.parse(matchs[j]);
              if (
                oneList.sport_id == oneMatch.sportid &&
                oneMatch.market &&
                oneMatch.market.length
              ) {
                await navCalcData(oneMatch);
                break;
              }
            }
          }
        }
        console.log(rdata, "========all==========");
        return res.json({ status: true, data: rdata });
      });
    });
  } else {
    return res.json({ status: true, data: [] });
  }
};

exports.getRecoveryEvent = async (req, res) => {
  let data = await baseController.BfindOne(sportsTemp, {
    key: sportsConfig.RecoveryEvent,
  });
  if (data) {
    return res.json({ status: true, data });
  } else {
    return res.json({ status: false });
  }
};
/////////////////////////////////////////////////////////////
exports.getFeaturedEvent = async (req, res) => {
  let returnData = [];

  async function getSportsListBackendChild(EventStatus, cb) {
    return new Promise(async function (resolve, reject) {
      redisClient.keys("*", async (err, keys) => {
        redisClient.mget(keys, async function (err, values) {
          if (values) {
            let list_data = [];
            for (let i = 0; i < values.length; i++) {
              let oneMatch = JSON.parse(values[i]);
              let index = list_data.findIndex(
                (item) => item.sport_id == oneMatch.sportid
              );
              if (index < 0) {
                let tempList = await baseController.BfindOne(sportsTypeList, {
                  status: true,
                  sport_id: oneMatch.sportid,
                });
                if (tempList) {
                  list_data.push(
                    Object.assign({}, tempList._doc, { count: 1 })
                  );
                }
              } else {
                list_data[index].count++;
              }
            }
            if (!list_data) {
              resolve([]);
            } else {
              list_data.sort(function (A, B) {
                return A.order < B.order ? -1 : 1;
              });
              resolve(list_data);
            }
          } else {
            resolve([]);
          }
        });
      });
    });
  }

  let sprotList = await getSportsListBackendChild();

  if (sprotList) {
    redisClient.keys("*", async (err, keys) => {
      redisClient.mget(keys, async function (err, values) {
        if (values) {
          for (let i = 0; i < values.length; i++) {
            let oneMatch = JSON.parse(values[i]);
            if (oneMatch && oneMatch.permission && oneMatch.isfeatured) {
              let market = [],
                T1X2,
                marketLen = 0;
              if (marketConfig[oneMatch.sportid]) {
                T1X2 = oneMatch.market.findIndex(
                  (item) =>
                    item.MarketName.toLowerCase().indexOf(
                      marketConfig[oneMatch.sportid]
                    ) > -1
                );
              } else {
                T1X2 = oneMatch.market.findIndex(
                  (item) => item.MarketName.toLowerCase() == "1x2"
                );
              }
              let THANDICAP = oneMatch.market.findIndex(
                (item) => item.MarketName.toLowerCase() == "handicap"
              );
              let TTOTAL = oneMatch.market.findIndex(
                (item) => item.MarketName.toLowerCase() == "total"
              );
              if (T1X2 > -1) {
                market.push(oneMatch.market[T1X2]);
              }
              if (THANDICAP > -1) {
                market.push(oneMatch.market[THANDICAP]);
              }
              if (TTOTAL > -1) {
                market.push(oneMatch.market[TTOTAL]);
              }

              for (let i = 0; i < oneMatch.market.length; i++) {
                if (oneMatch.market[i].MarketStatus == "Active") {
                  for (
                    let j = 0;
                    j < oneMatch.market[i].Outcomes.length;
                    j++
                  ) {
                    if (oneMatch.market[i].Outcomes[j].OutcomeStatus) {
                      marketLen++;
                      break;
                    }
                  }
                }
              }

              oneMatch.marketLen = marketLen;
              oneMatch.market = market;
              oneMatch.ScheduledTime = await changeTime(
                oneMatch.ScheduledTime
              );
              returnData.push(oneMatch);
            }
          }
          return res.json({ status: true, data: returnData, sprotList });
        } else {
          return res.json({ status: true, data: [] });
        }
      });
    });
  } else {
    return res.json({ status: true, data: [] });
  }
};

exports.getAllSportsEventsByEventStatus = async (req, res) => {
  let { EventStatus } = req.body;
  redisClient.keys("*", async (err, keys) => {
    redisClient.mget(keys, async function (err, values) {
      if (values) {
        let items = [];
        for (let i in values) {
          let item = JSON.parse(values[i]);
          if (item && item.EventStatus == EventStatus && item.permission) {
            let market = [],
              T1X2,
              marketLen = 0;
            if (marketConfig[item.sportid]) {
              T1X2 = item.market.findIndex(
                (a) =>
                  a.MarketName.toLowerCase().indexOf(
                    marketConfig[item.sportid]
                  ) > -1
              );
            } else {
              T1X2 = item.market.findIndex(
                (a) => a.MarketName.toLowerCase() == "1x2"
              );
            }
            let THANDICAP = item.market.findIndex(
              (item) => item.MarketName.toLowerCase() == "handicap"
            );
            let TTOTAL = item.market.findIndex(
              (item) => item.MarketName.toLowerCase() == "total"
            );
            if (T1X2 > -1) {
              market.push(item.market[T1X2]);
            }
            if (THANDICAP > -1) {
              market.push(item.market[THANDICAP]);
            }
            if (TTOTAL > -1) {
              market.push(item.market[TTOTAL]);
            }
            for (let i = 0; i < item.market.length; i++) {
              if (item.market[i].MarketStatus == "Active") {
                for (let j = 0; j < item.market[i].Outcomes.length; j++) {
                  if (item.market[i].Outcomes[j].OutcomeStatus) {
                    marketLen++;
                    break;
                  }
                }
              }
            }

            item.marketLen = marketLen;
            item.market = market;
            item.ScheduledTime = await changeTime(item.ScheduledTime);
            items.push(item);
          }
        }
        return res.json({ status: true, data: items });
      } else {
        return res.json({ status: false });
      }
    });
  });
};

exports.getSportsListPlayer = async (req, res) => {
  await this.getSportsListPlayerChild(req.body.data, (rdata) => {
    return res.json(rdata);
  });
};

exports.getSportsListPlayerChild = async (EventStatus, cb) => {
  redisClient.keys("*", async (err, keys) => {
    redisClient.mget(keys, async function (err, values) {
      // console.log(values.length, "values.length")
      if (values) {
        let list_data = [];
        for (let i = 0; i < values.length; i++) {
          let oneMatch = JSON.parse(values[i]);
          let ScheduledTime;
          if (
            oneMatch.ScheduledTime &&
            oneMatch.ScheduledTime.indexOf("IST") > -1
          ) {
            ScheduledTime = new Date(
              oneMatch.ScheduledTime.replace("IST", "GMT +05:30")
            ).valueOf();
          } else {
            ScheduledTime = new Date(oneMatch.ScheduledTime).valueOf();
          }

          if (
            (oneMatch.EventStatus != sportsConfig.LIVE &&
              oneMatch.EventStatus != sportsConfig.NOTSTARTED &&
              oneMatch.EventStatus != sportsConfig.SUSPENDED) ||
            (oneMatch.Status && oneMatch.Status.MatchStatus == "Ended") ||
            (oneMatch.EventStatus == sportsConfig.NOTSTARTED &&
              ScheduledTime < new Date().valueOf() - 24 * 60 * 60 * 1000) ||
            (oneMatch.EventStatus == sportsConfig.SUSPENDED &&
              ScheduledTime < new Date().valueOf() - 24 * 60 * 60 * 1000) ||
            (oneMatch.EventStatus == sportsConfig.LIVE &&
              ScheduledTime < new Date().valueOf() - 24 * 60 * 60 * 1000)
          ) {
            redisClient.del(
              `${oneMatch.event_id}_${oneMatch.sportid}`,
              async function (err, values) {}
            );
          }

          if (
            (EventStatus == sportsConfig.SPORTS ||
              oneMatch.EventStatus == EventStatus) &&
            oneMatch.permission
          ) {
            let index = list_data.findIndex(
              (item) => item.sport_id == oneMatch.sportid
            );
            if (index < 0) {
              let tempList = await baseController.BfindOne(sportsTypeList, {
                status: true,
                sport_id: oneMatch.sportid,
              });
              if (tempList) {
                list_data.push(Object.assign({}, tempList._doc, { count: 1 }));
              }
            } else {
              list_data[index].count++;
            }
          }
        }
        if (!list_data) {
          cb({ status: true, data: [] });
        } else {
          list_data.sort(function (A, B) {
            return A.order < B.order ? -1 : 1;
          });
          cb({ status: true, data: list_data });
        }
      } else {
        cb({ status: true, data: [] });
      }
    });
  });
};

exports.getSportsMatchPlayer = async (req, res) => {
  let data = req.body;
  let returnData = [];
  redisClient.keys(`*_${data.sportid}`, async (err, keys) => {
    redisClient.mget(keys, async function (err, oddsData) {
      async function navCalcData(match) {
        let market = [],
          marketLen = 0;
        let T1X2;
        if (marketConfig[data.sportid]) {
          T1X2 = match.market.findIndex(
            (item) =>
              item.MarketName.toLowerCase().indexOf(
                marketConfig[data.sportid]
              ) > -1
          );
        } else {
          T1X2 = match.market.findIndex(
            (item) => item.MarketName.toLowerCase() == "1x2"
          );
        }

        let THANDICAP = match.market.findIndex(
          (item) => item.MarketName.toLowerCase() == "handicap"
        );
        let TTOTAL = match.market.findIndex(
          (item) => item.MarketName.toLowerCase() == "total"
        );
        if (T1X2 > -1) {
          market.push(match.market[T1X2]);
        }
        if (THANDICAP > -1) {
          market.push(match.market[THANDICAP]);
        }
        if (TTOTAL > -1) {
          market.push(match.market[TTOTAL]);
        }

        for (let i = 0; i < match.market.length; i++) {
          if (match.market[i].MarketStatus == "Active") {
            for (let j = 0; j < match.market[i].Outcomes.length; j++) {
              if (match.market[i].Outcomes[j].OutcomeStatus) {
                marketLen++;
                break;
              }
            }
          }
        }

        match.marketLen = marketLen;
        match.market = market;
        match.ScheduledTime = await changeTime(match.ScheduledTime);
        let index = returnData.findIndex(
          (item) => item.event_id === match.event_id
        );
        if (index > -1) {
          returnData[index] = match;
          redisClient.del(
            `${returnData[index].event_id}_${returnData[index].sportid}`,
            async function (err, values) {}
          );
        } else {
          returnData.push(match);
        }
      }

      if (oddsData && oddsData.length) {
        for (let i = 0; i < oddsData.length; i++) {
          let oneMatch = JSON.parse(oddsData[i]);
          if (oneMatch.market.length && oneMatch.permission) {
            if (
              data.EventStatus == "Live" &&
              oneMatch.EventStatus == sportsConfig.LIVE
            ) {
              await navCalcData(oneMatch);
            } else if (
              data.EventStatus == "NotStarted" &&
              oneMatch.EventStatus == sportsConfig.NOTSTARTED
            ) {
              await navCalcData(oneMatch);
            } else if (data.EventStatus == "Next24") {
              if (
                oneMatch.ScheduledTime &&
                oneMatch.ScheduledTime.indexOf("IST") > -1
              ) {
                let ScheduledTime = new Date(
                  oneMatch.ScheduledTime.replace("IST", "GMT +05:30")
                );
                if (ScheduledTime - new Date() < 86400000) {
                  await navCalcData(oneMatch);
                }
              }
            } else if (data.EventStatus == "All") {
              await navCalcData(oneMatch);
            }
          }
        }
      }
      return res.json({ status: true, data: returnData });
    });
  });
};

exports.getOneMatchPlayer = async (req, res) => {
  redisClient.keys(`${req.body.event_id}_*`, (err, keys) => {
    redisClient.get(keys[0], async (err, fetchData) => {
      if (fetchData) {
        let rdata = JSON.parse(fetchData);
        rdata.ScheduledTime = await changeTime(rdata.ScheduledTime);
        return res.json({ status: true, data: rdata });
      } else {
        return res.json({ status: false, data: "Failure" });
      }
    });
  });
};

exports.cashOut = async (req, res) => {
  let data = req.body;
  await baseController.Bfind(sportsBet, {
    "betting.transactionId": Number(data.betting.transactionId),
  });
  const ip = await baseController.get_ipaddress(req);
  let mtsData = {
    ip,
    userid: req.user._id,
    count: data.bet.length,
    ticketid: transactionId,
    bets: [],
  };

  for (let i = 0; i < data.bet.length; i++) {
    mtsData.bets.push({
      stake: data.bet[i].AMOUNT * 10000,
      eventid: data.bet[i].GAMEID,
      product_id:
        data.bet[i].betting.sportid == 21
          ? 5
          : data.bet[i].betting.EventStatus == sportsConfig.LIVE
          ? 1
          : 3,
      sport_id: "sr:sport:" + data.bet[i].betting.sportid,
      market_id: data.bet[i].betting.MarketId,
      outcome_id: data.bet[i].betting.OutcomeId,
      specifier: data.bet[i].betting.MarketSpecifiers,
      odd: data.bet[i].betting.OutcomeOdds * 10000,
    });
    instance
      .get(`http://127.0.0.1:8500/newticket?data=${JSON.stringify(mtsData)}`)
      .then(() => {})
      .catch((err) => {});
  }
};

exports.getSportsBetHistory = async (req, res) => {
  let data = req.body;
  let searchData = {
    USERID: mongoose.Types.ObjectId(req.user._id),
  };
  if (data.selectId == 1) {
    searchData["betting.handleState"] = false;
  } else if (data.selectId == 2) {
    searchData["betting.handleState"] = true;
  } else if (data.betId) {
    searchData["betting.betId"] = data.betId;
  }
  let result = await baseController.Bfind(sportsBet, searchData);
  for (let i = 0; i < result.length; i++) {
    result[i].betting.Date = new Date(result[i].DATE).toLocaleString();
    if (result[i].betting.matchTime) {
      result[i].betting.matchTime = new Date(
        result[i].betting.matchTime
      ).toLocaleString();
    }
  }
  if (result) {
    return res.json({ status: true, data: result });
  } else {
    return res.json({ status: false });
  }
};

exports.getActiveBetCount = async (req, res) => {
  // let data = await sportsBet.aggregate([
  //     {
  //         $group: {
  //             _id: {
  //                 USERID: mongoose.Types.ObjectId(req.user._id),
  //                 "betting.handleState": false
  //             },
  //             "amount": { "$sum": "$AMOUNT" }
  //         }
  //     }
  // ])
  // if (data && data[0].amount) {
  // return res.json({ status: true, count: data[0].amount })
  return res.json({ status: true, count: 0 });
  // } else {
  //     return res.json({ status: false })
  // }
};

const changeTime = (time) => {
  if (time && time.indexOf("IST") > -1) {
    return new Date(time.replace("IST", "GMT +05:30"));
  } else {
    return new Date(time);
  }
};

/********************************   This is for MTS SDK  ******************************/
exports.mtsStatus = async (req, res) => {
  const io = req.app.get(sportsConfig.SOCKETIO);
  let sData = req.body;
  this.mtsStatusChild(sData, io);
  return res.send(true);
};

exports.cMtsStatus = async (req, res) => {
  let { ticketId, iscancel } = req.body;
  await baseController.BfindOneAndUpdate(
    sportsBet,
    { "betting.mtsId": Number(ticketId) },
    { "betting.iscancel": iscancel }
  );
  return res.send(true);
};

exports.mtsConnectionStatus = async (req, res) => {
  const io = req.app.get(sportsConfig.SOCKETIO);
  let fdata = req.body;
  if (fdata.isDisconnected == "true") {
    let ticketid = fdata.ticketid;
    let bets = await baseController.BfindOne(sportsBet, {
      "betting.mtsId": Number(ticketid),
    });
    await sportsBet.updateMany(
      { "betting.mtsId": Number(ticketid) },
      { "betting.mtsSent": false }
    );
    let sessionUser = await baseController.BfindOne(sessionmodel, {
      id: mongoose.Types.ObjectId(bets.USERID),
    });

    baseController.BfindOneAndUpdate(
      sportsTemp,
      { key: "mts" },
      { produceStatus: false, key: "mts" }
    );

    io.sockets.in(sessionUser.socketid).emit(sportsConfig.mtsStatus, {
      status: false,
      mts: true,
      msg: "Failure (mts)",
      betData: [{ USERID: bets.USERID }],
    });
  } else {
    baseController.BfindOneAndUpdate(
      sportsTemp,
      { key: "mts" },
      { produceStatus: true, key: "mts" }
    );
    let bets = await sportsBet.aggregate([
      {
        $match: {
          $and: [
            {
              "betting.mtsState": "pending",
            },
            {
              "betting.mtsSent": false,
            },
          ],
        },
      },
    ]);
    let temp = [];

    await sportsBet.updateMany(
      { "betting.mtsState": "pending" },
      { "betting.mtsSent": true }
    );

    for (let key = 0; key < bets.length; key++) {
      let data = bets[key];
      let flag = temp.findIndex((item) => item._id == data._id);
      if (flag < 0) {
        if (data.betting.betType == sportsConfig.MULTI) {
          temp.push(data);
          let mtsData = {
            ip: data.betting.ip,
            userid: data.USERID,
            count: 1,
            ticketid: data.betting.mtsId,
            bets: [],
            channel: data.betting.channel,
          };
          for (let i = key + 1; i < bets.length; i++) {
            if (bets[i].betting.mtsId == data.betting.mtsId) {
              temp.push(bets[i]);
              let spec = bets[i].betting.MarketSpecifiers;
              spec = spec.split(",").join("&");
              spec = spec.split("=").join("|");
              spec = spec.split("+").join("*");
              let outcome_id = bets[i].betting.OutcomeId.split("+").join("*");

              mtsData.bets.push({
                stake: bets[i].AMOUNT * 10000,
                eventid: bets[i].GAMEID,
                product_id:
                  bets[i].betting.sportid == 21
                    ? 5
                    : bets[i].betting.EventStatus == sportsConfig.LIVE
                    ? 1
                    : 3,
                sport_id: "sr:sport:" + bets[i].betting.sportid,
                market_id: bets[i].betting.MarketId,
                outcome_id: outcome_id,
                specifier: spec,
                odd: bets[i].betting.OutcomeOdds * 10000,
              });
            }
          }
          instance
            .get(
              `http://127.0.0.1:8500/newticket?data=${JSON.stringify(
                mtsData
              )}&&&key=1`
            )
            .then(() => {})
            .catch((err) => {});
        } else {
          temp.push(data);
          let mtsData = {
            ip: data.betting.ip,
            userid: data.USERID,
            count: 1,
            ticketid: data.betting.mtsId,
            bets: [],
            channel: data.betting.channel,
          };

          let spec = data.betting.MarketSpecifiers;
          spec = spec.split(",").join("&");
          spec = spec.split("=").join("|");
          spec = spec.split("+").join("*");

          let outcome_id = data.betting.OutcomeId.split("+").join("*");

          mtsData.bets.push({
            stake: data.AMOUNT * 10000,
            eventid: data.GAMEID,
            product_id:
              data.betting.sportid == 21
                ? 5
                : data.betting.EventStatus == sportsConfig.LIVE
                ? 1
                : 3,
            sport_id: "sr:sport:" + data.betting.sportid,
            market_id: data.betting.MarketId,
            outcome_id: outcome_id,
            specifier: spec,
            odd: data.betting.OutcomeOdds * 10000,
          });
          instance
            .get(
              `http://127.0.0.1:8500/newticket?data=${JSON.stringify(
                mtsData
              )}&&&key=1`
            )
            .then(() => {})
            .catch((err) => {});
        }
      }
    }
  }
  return res.send(true);
};

exports.ticketCancel = async (req, res) => {
  let sendData = {
    ticketid: req.body.data,
  };
  instance
    .get(
      `http://127.0.0.1:8500/newticket?data=${JSON.stringify(sendData)}&&&key=2`
    )
    .then(() => {});
  return res.send(true);
};

exports.cashStatus = async (req, res) => {
  return res.send(true);
};

exports.deleteAllMatchs = (req, res) => {
  redisClient.flushdb((err, result) => {
    sportsTemp.deleteOne({ key: "timestamp" }).then(() => {
      return res.send(true);
    });
  });
};

exports.deleteAllBet = (Req, res) => {
  sportsBet.deleteMany().then(() => {
    return res.send(true);
  });
};
