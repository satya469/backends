const request = require("request")
const shortid = require('shortid');
const encode = require('nodejs-base64-encode');
const { TransactionsHistory, paymentuserdetail, PaymentMenuModel, PaymoroSubmitData, Paymentconfig } = require("../../models/paymentGateWayModel")
const BASECON = require("../basecontroller")
const PCONFIG = require("../../config/pconfig")
const mongoose = require("mongoose")
const config = {
    paymentURL: "https://paygapi.payg.in/payment/api/order",
    AuthenticationKey: 'fcf4757eb5244fe4af2487ab04f8e40c',
    AuthenticationToken: "42842f0b0d0a491ba09b3abec11ae9d8",
    SecureHashKey: 'b29cd704083442e2ac2e73f903167da4',
    MerchantKeyId: "21521",
    RedirectUrl: "http://localhost:8080/thanks",
    timeout: 30
}

exports.paygcardpaymentCheckout = async (req, res, next) => {

    // let form_post = req.body

    const { paymentmenuid, amount, BillingAddress, BillingZipCode, MobileNo, BillingCity, BillingState, FirstName, LastName, Email } = req.body.params;
    let _id = req.user._id;

    var paymoroconfig = await PaymentMenuModel.findOne({ _id: paymentmenuid }).populate("paymentconfigurationid");
    if (paymoroconfig) {

        await BASECON.BfindOneAndUpdate(paymentuserdetail, {
            userid: mongoose.Types.ObjectId(_id),
            paymentconfigid: paymentmenuid
        },
            {
                paymentData:
                {
                    BillingAddress,
                    BillingZipCode,
                    MobileNo,
                    BillingCity,
                    BillingState,
                    FirstName,
                    LastName,
                    Email,
                }
            });

        let configData = paymoroconfig.paymentconfigurationid;
        let orderId = shortid.generate();
        let useritem = req.user;
        let form_post = {
            OrderAmount: Number(amount).toFixed(2),
            AmountTypeDesc: '3',
            Amount: '1001',
            UserName: useritem.username,
            Source: '3213',
            IntegrationType: '11',
            HashData: '',
            PlatformId: '1',
            CustomerId: useritem._id,
            CustomerNotes: 'amway product',
            FirstName: FirstName,
            LastName: LastName,
            MobileNo: MobileNo,
            Email: Email,
            EmailReceipt: 'true',
            BillingAddress: BillingAddress,
            BillingCity: BillingCity,
            BillingState: BillingState,
            BillingCountry: 'India',
            BillingZipCode: BillingZipCode,
            ShippingFirstName: FirstName,
            ShippingLastName: LastName,
            ShippingAddress: BillingAddress,
            ShippingCity: BillingCity,
            ShippingState: BillingState,
            ShippingCountry: 'India',
            ShippingZipCode: BillingZipCode,
            ShippingMobileNo: MobileNo
        }

        let transactionData = {
            type: configData.type,
            email: useritem.email,
            amount: amount,
            realamount: amount,
            status: PCONFIG.Pending,
            requestData: {},
            order_no: orderId,
            wallettype: "DEPOSIT",
            userid: mongoose.Types.ObjectId(useritem._id)
        }

        this.depositrequest(form_post, configData, transactionData, rdata => {
            if (rdata) {
                res.send({
                    status: true,
                    data: rdata
                })
                return next()
            } else {
                res.send({
                    status: false,
                    data: rdata
                })
                return next()
            }
        })
    } else {
        return res.json({ status: false, data: 'fail' });
    }
}

exports.paygcardpaymentGetTransactionStatus = async (req, res, next) => {
    let { order_no } = req.body
    if (order_no) {

        let rdata = await TransactionsHistory.findOne({order_no})
        if (rdata) {

            let OrderKeyId = rdata.requestData.OrderKeyId
            let headerurl = `${config.AuthenticationKey}:${config.AuthenticationToken}:M:${config.MerchantKeyId}`;
            let encode_header_credentail = encode.encode(headerurl, 'base64');
    
            var form_post = JSON.parse(JSON.stringify(req.body));
    
            var options = {
                method: 'POST',
                url: config.paymentURL + '/Detail',
                headers:
                {
                    'postman-token': 'd0b751f6-ffce-e5e0-e7a5-56d0129fbe88',
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    authorization: 'Basic ' + encode_header_credentail
                },
                body:
                {
                    OrderKeyId: OrderKeyId,
                    MerchantKeyId: config.MerchantKeyId,
                    PaymentType: ''
                },
                json: true
            };
    
            request(options, function (error, response, body) {
                if (error) throw new Error(error);
    
                res.render('order_detail', { title: 'Order detail333', body: body });
            });

        } else {

        }

    } else {

    }

}
exports.depositrequest = (form_post, configs, transactionData, callback) => {


    let configdata = configs.configData;

    let headerurl = `${configdata.AuthenticationKey}:${configdata.AuthenticationToken}:M:${configdata.MerchantKeyId}`;
    let encode_header_credentail = encode.encode(headerurl, 'base64');

    var options = {
        method: 'POST',
        url: configdata.paymentURL + '/create',
        headers:
        {
            'content-type': 'application/json',
            authorization: 'Basic ' + encode_header_credentail
        },
        body:
        {
            Merchantkeyid: configdata.MerchantKeyId,
            UniqueRequestId: transactionData.order_no,
            OrderStatus: 'Initiating',
            UserDefinedData: { UserDefined1: '' },
            RequestDateTime: new Date().toLocaleDateString(),
            RedirectUrl: configdata.RedirectUrl + transactionData.order_no,
            TransactionData:
            {
                AcceptedPaymentTypes: '',
                PaymentType: '',
                SurchargeType: '',
                SurchargeValue: '',
                RefTransactionId: '',
                IndustrySpecificationCode: '',
                PartialPaymentOption: ''
            },
            OrderAmount: form_post.OrderAmount,
            OrderType: 'MOBILE',
            OrderAmountData: {
                AmountTypeDesc: form_post.AmountTypeDesc, Amount: form_post.Amount
            },
            CustomerData:
            {
                CustomerId: form_post.CustomerId,
                CustomerNotes: form_post.CustomerNotes,
                FirstName: form_post.FirstName,
                LastName: form_post.LastName,
                MobileNo: form_post.MobileNo,
                Email: form_post.Email,
                EmailReceipt: form_post.EmailReceipt,
                BillingAddress: form_post.BillingAddress,
                BillingCity: form_post.BillingCity,
                BillingState: form_post.BillingState,
                BillingCountry: form_post.BillingCountry,
                BillingZipCode: form_post.BillingZipCode,
                ShippingFirstName: form_post.ShippingFirstName,
                ShippingLastName: form_post.ShippingLastName,
                ShippingAddress: form_post.ShippingAddress,
                ShippingCity: form_post.ShippingCity,
                ShippingState: form_post.ShippingState,
                ShippingCountry: form_post.ShippingCountry,
                ShippingZipCode: form_post.ShippingZipCode,
                ShippingMobileNo: form_post.ShippingMobileNo,
            },
            IntegrationData:
            {
                UserName: form_post.UserName,
                Source: 'MobileSDK',
                IntegrationType: '11',
                HashData: form_post.HashData,
                PlatformId: form_post.PlatformId
            }
        },
        json: true
    };
    request(options, async function (error, response, body) {
        if (error) {
            callback(false)
        } else {
            if (response.statusCode == 201) {

                transactionData['requestData'] = {
                    OrderKeyId: response.body.OrderKeyId
                }
                var txnsave = await BASECON.data_save(transactionData, TransactionsHistory);
                if (txnsave) {
                    callback(response.body.PaymentProcessUrl)
                } else {
                    callback(false)
                }
            } else {
                callback(false)
            }
        }
    });

}