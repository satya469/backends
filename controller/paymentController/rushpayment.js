const axios = require('axios');
const qs = require('qs');
const PCONFIG = require("../../config/pconfig")
const { TransactionsHistory, paymentuserdetail, PaymentMenuModel, PaymoroSubmitData, Paymentconfig } = require("../../models/paymentGateWayModel")
const BASECON = require("../basecontroller")
const mongoose = require('mongoose');
const Paymorocontrol = require("./paymoro")
const transactionControl = require("./Transaction")


exports.callback = async (req, res, next) => {

  
  // {
  //   "Status": "Failed",
  //   "order_id": "RushPay1623048380406",
  //   "amount": "50",
  //   "Txt_Ref": ""
  // }

  // This is payload for Failed Transaction

  // For Success:

  // {
  //   "Status": "Successful",
  //   "order_id": "RushPay1623048380406",
  //   "amount": "50",
  //   "Txt_Ref": "12352563525"
  // }
  let ipaddress = BASECON.get_ipaddress(req)

  var updata = {};
  let rate = await BASECON.getExchangeRate();
  var txnhis = await BASECON.BfindOne(TransactionsHistory, { order_no: req.body.order_id });
  var userdata = await BASECON.playerFindbyUseridUpdate(txnhis.userid);
  if (txnhis && userdata) {
    let amount = txnhis.realamount * rate;
    if (req.body.Status == "Successful") {

      // const { fee } = await PaymentMenuModel.findOne({type})
      // let balance = parseFloat(amount) - parseFloat(amount) * parseFloat(fee)/100

      if (txnhis.status != PCONFIG.Approve) {
        await BASECON.paymentlog({
          type:"rushpaymentdeposit",
          data: req.body,
        })
        
        var wallets = {
          commission: 0,
          status: "DEPOSIT",
          roundid: req.body.order_id,
          transactionid: req.body.order_id,
          // LAUNCHURL: "cash",
          // GAMEID: "RuPeePay",
          userid: mongoose.Types.ObjectId(userdata.id),
          credited: amount,
          debited: 0,
          lastbalance: userdata.balance,
          paymentid : mongoose.Types.ObjectId(txnhis._id),
          ipaddress
        }
        updata["status"] = PCONFIG.Approve;
        updata["lastbalance"] = userdata.balance;
        var current = await BASECON.email_balanceupdate(txnhis.email, amount, wallets);
        updata["updatedbalance"] = current;
      }

    } else {
      updata["status"] = PCONFIG.Reject;
      updata["lastbalance"] = userdata.balance;
      updata["updatedbalance"] = userdata.balance;
    }

    updata["order_no"] = txnhis.order_no;
    updata["userid"] = txnhis.userid;
    updata["amount"] = amount;
    // await BASECONTROL.BfindOneAndUpdate(TransactionsHistory,{ order_no : mchOrderNo}, updata);
    Paymorocontrol.transactionUpdate(updata);

  }
  return res.status(200).send()
}

exports.payoutrushpaymentcallback = async (req, res, next) => {

  await BASECON.paymentlog({
    type:"rushpaymentpayout",
    data: req.body,
  })

  let { order_id, Status } = req.body;
  
  var txnhis = await BASECON.BfindOne(TransactionsHistory, { order_no: order_id });
  var userdata = await BASECON.playerFindbyUseridUpdate(txnhis.userid);
  if (txnhis && userdata) {
    if (txnhis.status == PCONFIG.Paid) {
      if (Status == "Successful") {

        await TransactionsHistory.findOneAndUpdate({ _id: txnhis._id }, { status: PCONFIG.Approve });
      } else if (Status == "Failed") {

        await TransactionsHistory.findOneAndUpdate({ _id: txnhis._id }, { status: PCONFIG.Reject });
        await transactionControl.balancRefund(userdata, txnhis);
      }
    } else {

    }
  }
  return res.status(200).send()
}

exports.rushpayAxios = async (config) => {
  let data = {}
  await axios(config)
    .then(function (response) {
      data = response.data
    })
    .catch(function (error) {
      data = null
    })
  return data
}

exports.depositpaymentrequest = async (req, res, next) => {

  const { paymentmenuid, amount } = req.body.params;
  let _id = req.user._id;


  var paymoroconfig = await PaymentMenuModel.findOne({ _id: paymentmenuid }).populate("paymentconfigurationid");
  if (paymoroconfig) {

    let configData = paymoroconfig.paymentconfigurationid;
    let apikey = configData.configData.apikey;
    let merchatid = configData.configData.merchatid;
    let paymentrequesturl = configData.configData.paymentrequesturl;
    let notifyUrl = configData.configData.notifyUrl;

    let orderId = "rp" + new Date().valueOf();
    let useritem = req.user;
    let transactionData = {
      type: configData.type,
      email: useritem.email,
      realamount: parseInt(amount),
      amount: parseInt(amount),
      status: PCONFIG.Pending,
      requestData: {},
      order_no: orderId,
      wallettype: "DEPOSIT",
      userid: mongoose.Types.ObjectId(useritem._id)
    }

    var data = qs.stringify({
      'order_id': orderId,
      'amount': amount.toFixed(2),
      'environment': notifyUrl,
      'me_id': merchatid
    });
    var config = {
      method: 'post',
      url: paymentrequesturl,
      headers: {
        'APIKey': apikey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: data
    }

    let ret = await this.rushpayAxios(config)
    if (ret && ret.status == "Success") {
      var txnsave = await BASECON.data_save(transactionData, TransactionsHistory);
      if (txnsave) {
        return res.json({ status: true, data: ret.reason })
      } else {
        return res.json({ status: false, data: 'fail' });
      }
    } else {
      return res.json({ status: false, data: 'fail' });
    }
  } else {
    return res.json({ status: false, data: 'fail' });
  }

}

exports.payoutRequestRushPayUPI = async (last_item, paymentconfig, data, itemuser, callback) => {
  let accountname = itemuser.paymentData.accountName;
  var accountnumber = itemuser.paymentData.accountNumber
  var upi_id = itemuser.paymentData.UpiId;
  // var username = useritem.userid.username;
  // var bankname = itemuser.paymentData.accountName;
  // var bankbranch = accountname;
  // var bankaddress = accountname;

  const { upidpayoutrequesturl, payoutcallbackurl, merchatid, apikey } = paymentconfig.paymentconfigurationid.configData;
  let balance = parseFloat(last_item.amount).toFixed(2);
  var orderId = last_item.order_no;

  var body = qs.stringify({
    'order_id': orderId,
    'amount': balance,
    'environment': payoutcallbackurl,
    'me_id': merchatid,
    'account_number': accountnumber,
    'upi_id': upi_id,
    'beneficiary_name': accountname
  });
  var config = {
    method: 'post',
    url: upidpayoutrequesturl,
    headers: {
      'APIKey': apikey,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: body
  }
  let ret = await this.rushpayAxios(config)
  if (ret && ret.status == "Success") {
    callback({ status: true, error: "success" });
  } else {
    callback({ status: false, error: ret.reason })
  }
}

exports.payoutRequest = async (last_item, paymentconfig, data, itemuser, callback) => {
  let accountname = itemuser.paymentData.accountName;
  var accountnumber = itemuser.paymentData.accountNumber
  var bankifsc = itemuser.paymentData.IfscCode;
  // var username = useritem.userid.username;
  // var bankname = itemuser.paymentData.accountName;
  // var bankbranch = accountname;
  // var bankaddress = accountname;

  const { impspayoutrequesturl, payoutcallbackurl, merchatid, apikey } = paymentconfig.paymentconfigurationid.configData;
  let balance = parseFloat(last_item.amount).toFixed(2);
  var orderId = last_item.order_no;

  var body = qs.stringify({
    'order_id': orderId,
    'amount': balance,
    'environment': payoutcallbackurl,
    'me_id': merchatid,
    'account_number': accountnumber,
    'ifsc': bankifsc,
    'beneficiary_name': accountname
  });
  var config = {
    method: 'post',
    url: impspayoutrequesturl,
    headers: {
      'APIKey': apikey,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: body
  }

  let ret = await this.rushpayAxios(config)
  if (ret && ret.status == "Success") {
    callback({ status: true, error: "success" });
  } else {
    callback({ status: false, error: ret.reason })
  }
}