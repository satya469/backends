const USERS = require("../models/users_model");
const playersUser = USERS.GamePlay;
const session_model = USERS.sessionmodel;
const wallethistory_model = USERS.wallethistory;
const config = require('../db');
const IPblockModel = require("../models/tools_model").toolgetoipblock_model;
const EXCHGCONFIG = require("../config/exchgXmlConfig");
const path = require("path");
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const timermoment = require('moment')
const axios = require("axios");
const crypto = require('crypto');
const url = require('url');
const fs = require("fs");
const moment = require('moment-timezone');
const { GamePlay } = require("../models/users_model");
const { firstpagesetting, CurrencyOptions } = require("../models/firstpage_model");
const { paymentlogs } = require("../models/paymentGateWayModel");

const ENCRYPTION_KEY = "e807f1fcf82d132f9bb018ca6738a19f"; // Must be 256 bits (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16

exports.bGetCount = async (model, condition = {}) => {
	try {
		let findhandle = null;
		await model.countDocuments(condition).then(rdata => {
			findhandle = rdata;
		});
		if (findhandle || findhandle === 0) {
			return findhandle;
		} else {
			return 0;
		}
	} catch (e) {
		return false;
	}
}

exports.setPage = (params, totalcount) => {
	let {
		page,
		perPage
	} = params;
	let newparams = {}, totalPages;
	if (page !== undefined && perPage !== undefined) {
		totalPages = Math.ceil(totalcount / perPage);
		let calculatedPage = (page - 1) * perPage;
		if (calculatedPage > totalcount) {
			newparams['page'] = 1;
			newparams['perPage'] = parseInt(perPage);
		} else {
			newparams['perPage'] = parseInt(perPage);
			newparams['page'] = parseInt(page);
		}
	} else {
		totalPages = Math.ceil(totalcount / 10);
		newparams['page'] = 1;
		newparams['perPage'] = 10;
	}

	let index1 = newparams.page == 0 ? 0 : newparams.page - 1;
	let index2 = newparams.page == 0 ? 1 : newparams.page;
	let skip = index1 * (newparams.perPage);
	let limit = index2 * (newparams.perPage);

	return {
		totalPages,
		params: newparams,
		skip,
		limit,
		totalRecords: totalcount
	}
}


exports.paymentlog = async (data) => {
	let d = await this.data_save(data, paymentlogs)
}

exports.validateEmailType = (email) => {
	const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	return re.test(String(email).toLowerCase());
}


exports.getExchangeRate = async () => {
	let rate = 1
	let dd = await CurrencyOptions.findOne({ active: true });
	if (dd) {
		rate = dd.rate
	}
	return rate
}

exports.SuperadminChecking = (id) => {
	let superadmins = ["1602594948413", "1619266700079", "1622828166076"];
	if (superadmins.indexOf(id) == -1) {
		return false
	} else {
		return true
	}
}

exports.SuperigamezChecking = (id) => {
	let superadmins = ["1619266700079"];
	if (superadmins.indexOf(id) == -1) {
		return false
	} else {
		return true
	}
}

exports.BazarTimeCheck = (time, bool) => {
	let l = time
	// let l = "20:12"
	// let bool = 15
	let m = new Date().getMinutes()
	let h = new Date().getHours()
	let mn = h * 60 + m
	let last = parseInt(l.split(":")[0]) * 60 + parseInt(l.split(":")[1])
	let dd = last - mn
	if (dd > bool) {
		// 15min before
		return 1
	} else if (dd <= bool && dd > 0) {
		// 15min between
		return 2
	} else {
		// 15min after 
		return 3
	}
}



exports.getWinningComission = async () => {
	let comission = 2
	let curen = await firstpagesetting.findOne({ type: "WinningComission" });
	if (curen && curen.content && curen.content.status && curen.content.comission) {
		comission = parseInt(curen.content.comission)
	} else {
		comission = 2
	}
	return comission
}

exports.getPlatFormFee = async () => {
	let comission = 4
	let curen = await firstpagesetting.findOne({ type: "PlatFormFees" });
	if (curen && curen.content && curen.content.comission) {
		comission = parseInt(curen.content.comission)
	} else {
		comission = 4
	}
	return comission
}

exports.getbetdeplaytime = async () => {
	let comission = 6000
	let curen = await firstpagesetting.findOne({ type: "Betdelaytime" });
	if (curen && curen.content && curen.content) {
		comission = parseInt(curen.content)
	} else {
		comission = 6000
	}
	return comission
}

exports.getExposurelimit = async () => {
	let sattalimit = 10000,
		sportsbooklimit = 10000,
		exchangelimit = 10000
	let curen = await firstpagesetting.findOne({ type: "ExposureLimit" });
	if (curen && curen.content) {
		sportsbooklimit = curen.content.sportsbooklimit
		sattalimit = curen.content.sattalimit
		exchangelimit = curen.content.exchangelimit
	}
	return {
		sattalimit,
		sportsbooklimit,
		exchangelimit
	}
}

exports.getWinningLimit = async () => {
	let skill = 50000,
		livecasino = 50000,
		casino = 50000
	let curen = await firstpagesetting.findOne({ type: "WinningLimit" });
	if (curen && curen.content) {
		livecasino = curen.content.livecasino
		skill = curen.content.skill
		casino = curen.content.casino
	}
	return {
		skill,
		livecasino,
		casino
	}
}

exports.Indiatime = () => {
	var time = moment.tz(new Date(), "Asia/Kolkata");
	time.utc("+530").format();
	return time;
}

exports.IndiatimeFromTime = (time) => {
	var time = moment.tz(new Date(new Date(time).valueOf() + 10000), "Asia/Kolkata");
	time.utc("+530").format();
	return time;
}

exports.getPlayerBalanceCorrect = (item) => {
	if (item.balance < 0) {
		return 0
	} else {
		return parseInt(item.balance)
	}
}

exports.getPlayerBonusBalanceCorrect = (item) => {
	if (item.balance < 0) {
		return parseInt(item.bonusbalance + item.balance)
	} else {
		return parseInt(item.bonusbalance)
	}
}

exports.getPlayerBalanceCal = (item) => {
	if (item.balance < 0) {
		let row = {
			balance: 0,
			bonusbalance: parseInt(item.bonusbalance + item.balance),
			sattalimit: item.sattalimit,
			exchangelimit: item.exchangelimit,
			sportsbooklimit: item.sportsbooklimit,
			betdelaytime: item.betdelaytime,
			casino: item.casino,
			livecasino: item.livecasino,
			skill: item.skill,
		}
		return row;
	} else {
		let row = {
			balance: parseInt(item.balance),
			bonusbalance: parseInt(item.bonusbalance),
			sattalimit: item.sattalimit,
			exchangelimit: item.exchangelimit,
			sportsbooklimit: item.sportsbooklimit,
			betdelaytime: item.betdelaytime,
			casino: item.casino,
			livecasino: item.livecasino,
			skill: item.skill,
		}
		return row;
	}
}

exports.playerFindbyEmailUpdate = async (email) => {
	let item = await playersUser.findOne({ email: email });
	if (item) {
		let d = this.getPlayerBalanceCal(item)
		let row = await this.BfindOneAndUpdate(playersUser, { email: email }, { balance: d.balance, bonusbalance: d.bonusbalance });
		return row;
	} else {
		return false;
	}
}

exports.playerFindbyUseridUpdate = async (userid) => {
	let item = await playersUser.findOne({ userid: userid });
	if (item) {
		let d = this.getPlayerBalanceCal(item)
		let row = await this.BfindOneAndUpdate(playersUser, { userid: userid }, { balance: d.balance, bonusbalance: d.bonusbalance });
		return row;
	} else {
		return false;
	}
}

exports.PlayerFindByemail = async (email) => {
	let item = await playersUser.findOne({ email: email });
	if (item) {
		let d = this.getPlayerBalanceCal(item)
		let row = Object.assign({}, item._doc);
		row['balance'] = d.balance
		row['bonusbalance'] = d.bonusbalance
		return row;
	} else {
		return false;
	}
}

exports.playerFindByid = async (id) => {
	let item = await playersUser.findOne({ id: id });
	if (item) {
		let d = this.getPlayerBalanceCal(item)
		let row = Object.assign({}, item._doc);
		row['balance'] = d.balance
		row['bonusbalance'] = d.bonusbalance
		return row;
	} else {
		return false;
	}
}

exports.getPlayerBalanceCal_ = (item) => {
	if (item.balance < 0) {
		let row = {
			balance: parseInt(item.bonusbalance + item.balance),
			bonusbalance: parseInt(item.bonusbalance + item.balance),
			sattalimit: item.sattalimit,
			exchangelimit: item.exchangelimit,
			sportsbooklimit: item.sportsbooklimit,
			betdelaytime: item.betdelaytime
		}
		return row;
	} else {
		let row = {
			balance: parseInt(item.bonusbalance + item.balance),
			bonusbalance: parseInt(item.bonusbalance),
			sattalimit: item.sattalimit,
			exchangelimit: item.exchangelimit,
			sportsbooklimit: item.sportsbooklimit,
			betdelaytime: item.betdelaytime
		}
		return row;
	}
}

exports.encrypt = (text) => {
	let iv = crypto.randomBytes(IV_LENGTH);
	let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
	let encrypted = cipher.update(text);
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	return iv.toString('hex') + ':' + encrypted.toString('hex');
}

exports.decrypt = (text) => {
	try {
		let textParts = text.split(':');
		let iv = Buffer.from(textParts.shift(), 'hex');
		let encryptedText = Buffer.from(textParts.join(':'), 'hex');
		let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
		let decrypted = decipher.update(encryptedText);
		decrypted = Buffer.concat([decrypted, decipher.final()]);
		return decrypted.toString();
	} catch (e) {
		return false
	}
}

exports.is_check_imgage = (image, item) => {

	if (item.PROVIDERID == "EZUGI") {
		if (image && image.length > 0 && image.slice(0, 5) === "https") {
			var res = syncrequest('GET', image + "");
			if (res.statusCode == "200" || res.statusCode == 200) {
				return true;
			} else {
				return false
			}
		} else {
			return true;
		}
	} else {
		return true;
	}

}

exports.ipcheck = (req, res, next) => {
	var ip = this.get_ipaddress(req);
	if (ip) {
		IPblockModel.findOne({ ipaddress: ip }).then(rdata => {
			if (rdata) {
				res.sendFile(path.join(config.DIR, 'client/welcome.html'));
			} else {
				next();
			}
		})
	} else {
		next();
	}
}

exports.get_ipaddress = (req) => {
	var forwarded = req.headers['x-forwarded-for']
	var ips = forwarded ? forwarded.split(/, /)[0] : req.connection.remoteAddress;
	var ip = ips && ips.length > 0 && ips.indexOf(",") ? ips.split(",")[0] : null;
	return ip;
}

exports.sendnotification = (req, res, next) => {

}

var sendNotification = function (data) {
	var headers = {
		"Content-Type": "application/json; charset=utf-8",
		"Authorization": "Basic NGEwMGZmMjItY2NkNy0xMWUzLTk5ZDUtMDAwYzI5NDBlNjJj"
	};

	var options = {
		host: "onesignal.com",
		port: 443,
		path: "/api/v1/notifications",
		method: "POST",
		headers: headers
	};

	var https = require('https');
	var req = https.request(options, function (res) {
		res.on('data', function (data) {
		});
	});

	req.on('error', function (e) {
	});

	req.write(JSON.stringify(data));
	req.end();
};

var message = {
	app_id: "5eb5a37e-b458-11e3-ac11-000c2940e62c",
	contents: { "en": "English Message" },
	filters: [
		{ "field": "tagv", "key": "level", "relation": "=", "value": "10" },
		{ "operator": "OR" }, { "field": "amount_spent", "relation": ">", "value": "0" }
	]
};

exports.get_accessPassword = (privatekey, parameter) => {
	var str = privatekey;
	for (var i in parameter) {
		str += i + "=" + parameter[i] + "&";
	}
	str = str.slice(0, str.length - 1);
	var md5str = get_md5string(str);
	var md5 = md5str.toLocaleUpperCase()
	return md5;
}

exports.getUserItem = req => {
	var id = req.user;
	return id;
}

exports.getBazarCreateDate = (toDateString) => {
	const start = (new Date(new Date(toDateString).valueOf() + 6 * 3600 * 1000));
	return start
}

exports.get_stand_date_first = (date) => {
	return new Date(timermoment(new Date(date)).format('YYYY-MM-DD'))
}

exports.get_stand_date_end = (date) => {
	return new Date(timermoment(new Date(date)).format('YYYY-MM-DD'))
}

exports.get_stand_date_end1 = (date) => {
	return new Date(timermoment(new Date(new Date(date).valueOf() + 24 * 60 * 60 * 1000)).format('YYYY-MM-DD'))
}


exports.get_stand_date_last = (date) => {
	return new Date(timermoment(new Date(new Date(date).valueOf() - 24 * 60 * 60 * 1000)).format('YYYY-MM-DD'))
}

exports.Bfind = async (model, condition = {}) => {
	try {
		var findhandle = null;
		await model.find(condition).then(rdata => {
			findhandle = rdata;
		});
		if (!findhandle) {
			return false;
		} else {
			return findhandle;
		}
	} catch (e) {
		return false;
	}
}

exports.BfindSort = async (model, condition = {}) => {
	try {
		var outdata = null;
		await model.find(condition).sort({ order: 1 }).then(rdata => {
			if (!rdata) {
				outdata = false;
			} else {
				outdata = rdata;
			}
		});
		return outdata;
	} catch (e) {
		return false;
	}
}

exports.get_date = () => {
	return new Date(timermoment(new Date()).format('YYYY-MM'))
	// var d = new Date();
	// var year = d.getFullYear();
	// var month = parseInt(d.getMonth()) + 1;
	// var mh = month > 9 ? month : "0" + month;
	// var datestring = year + "-"+mh;

	// return datestring;
}

exports.md5convert = (string) => {
	var aa = get_md5string(string);
	return aa;
}

exports.headers = () => {
	return { 'Content-Type': 'application/x-www-form-urlencoded' };
}

exports.cv_ebase64 = (rstring) => {
	let buff = new Buffer(rstring);
	let base64data = buff.toString('base64');
	return base64data
}

exports.cv_dbase64 = (rstring) => {
	let buff = new Buffer(rstring, 'base64');
	let text = buff.toString('ascii');
	return text;
}

exports.data_save = async (indata, model) => {
	// try{
	var handle = null;
	var savehandle = new model(indata);
	await savehandle.save().then(rdata => {
		if (!rdata) {
			handle = false;
		} else {
			handle = rdata;
		}
	});
	return handle;
	// }catch(e){
	// 	return false;
	// }
}

exports.BSave = async (indata) => {
	// try{
	var handle = null;
	await indata.save().then(rdata => {
		if (!rdata) {
			handle = false;
		} else {
			handle = rdata;
		}
	});
	return handle;
	// }catch(e){
	// 	return false;
	// }
}

exports.BSortfind = async (modal, condition = {}, sortcondition = {}) => {
	// try{
	var data;
	await modal.find(condition).sort(sortcondition).then(rdata => {
		data = rdata;
	});
	if (!data) {
		return false;
	} else {
		return data;
	}
	// }catch(e){
	// 	return false;
	// }
}

exports.BSortfindSelect = async (modal, condition = {}, sortcondition = {}, select = "") => {
	try {
		var data;
		await modal.find(condition, select).sort(sortcondition).then(rdata => {
			data = rdata;
		});
		if (!data) {
			return false;
		} else {
			return data;
		}
	} catch (e) {
		return false;
	}
}

exports.BSortfindPopulate = async (modal, condition = {}, sortcondition = {}, populatestring) => {
	try {
		var data;
		await modal.find(condition).populate(populatestring).sort(sortcondition).then(rdata => {
			data = rdata;
		});
		if (!data) {
			return false;
		} else {
			return data;
		}
	} catch (e) {
		return false;
	}
}

// exports.jwt_encode = async function(string){
// 	var token = await JWTTOEKN.jwt_encode(string);
//     return token;
// }

// exports.jwt_decode =async function(string){
// 	var token = await JWTTOEKN.jwt_decode(string);	
// 	return token;
// }

function get_md5string(string) {
	function RotateLeft(lValue, iShiftBits) {
		return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
	}
	function AddUnsigned(lX, lY) {
		var lX4, lY4, lX8, lY8, lResult;
		lX8 = (lX & 0x80000000);
		lY8 = (lY & 0x80000000);
		lX4 = (lX & 0x40000000);
		lY4 = (lY & 0x40000000);
		lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
		if (lX4 & lY4) {
			return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
		}
		if (lX4 | lY4) {
			if (lResult & 0x40000000) {
				return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
			} else {
				return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
			}
		} else {
			return (lResult ^ lX8 ^ lY8);
		}
	}

	function F(x, y, z) { return (x & y) | ((~x) & z); }
	function G(x, y, z) { return (x & z) | (y & (~z)); }
	function H(x, y, z) { return (x ^ y ^ z); }
	function I(x, y, z) { return (y ^ (x | (~z))); }

	function FF(a, b, c, d, x, s, ac) {
		a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
		return AddUnsigned(RotateLeft(a, s), b);
	};

	function GG(a, b, c, d, x, s, ac) {
		a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
		return AddUnsigned(RotateLeft(a, s), b);
	};

	function HH(a, b, c, d, x, s, ac) {
		a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
		return AddUnsigned(RotateLeft(a, s), b);
	};

	function II(a, b, c, d, x, s, ac) {
		a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
		return AddUnsigned(RotateLeft(a, s), b);
	};

	function ConvertToWordArray(string) {
		var lWordCount;
		var lMessageLength = string.length;
		var lNumberOfWords_temp1 = lMessageLength + 8;
		var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
		var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
		var lWordArray = Array(lNumberOfWords - 1);
		var lBytePosition = 0;
		var lByteCount = 0;
		while (lByteCount < lMessageLength) {
			lWordCount = (lByteCount - (lByteCount % 4)) / 4;
			lBytePosition = (lByteCount % 4) * 8;
			lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
			lByteCount++;
		}
		lWordCount = (lByteCount - (lByteCount % 4)) / 4;
		lBytePosition = (lByteCount % 4) * 8;
		lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
		lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
		lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
		return lWordArray;
	};

	function WordToHex(lValue) {
		var WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
		for (lCount = 0; lCount <= 3; lCount++) {
			lByte = (lValue >>> (lCount * 8)) & 255;
			WordToHexValue_temp = "0" + lByte.toString(16);
			WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
		}
		return WordToHexValue;
	};

	function Utf8Encode(string) {
		string = string.replace(/\r\n/g, "\n");
		var utftext = "";

		for (var n = 0; n < string.length; n++) {

			var c = string.charCodeAt(n);

			if (c < 128) {
				utftext += String.fromCharCode(c);
			}
			else if ((c > 127) && (c < 2048)) {
				utftext += String.fromCharCode((c >> 6) | 192);
				utftext += String.fromCharCode((c & 63) | 128);
			}
			else {
				utftext += String.fromCharCode((c >> 12) | 224);
				utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				utftext += String.fromCharCode((c & 63) | 128);
			}

		}

		return utftext;
	};

	var x = Array();
	var k, AA, BB, CC, DD, a, b, c, d;
	var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
	var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
	var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
	var S41 = 6, S42 = 10, S43 = 15, S44 = 21;

	string = Utf8Encode(string);

	x = ConvertToWordArray(string);

	a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;

	for (k = 0; k < x.length; k += 16) {
		AA = a; BB = b; CC = c; DD = d;
		a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
		d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
		c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
		b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
		a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
		d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
		c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
		b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
		a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
		d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
		c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
		b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
		a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
		d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
		c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
		b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
		a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
		d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
		c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
		b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
		a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
		d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
		c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
		b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
		a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
		d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
		c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
		b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
		a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
		d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
		c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
		b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
		a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
		d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
		c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
		b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
		a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
		d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
		c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
		b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
		a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
		d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
		c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
		b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
		a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
		d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
		c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
		b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
		a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
		d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
		c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
		b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
		a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
		d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
		c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
		b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
		a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
		d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
		c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
		b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
		a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
		d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
		c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
		b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
		a = AddUnsigned(a, AA);
		b = AddUnsigned(b, BB);
		c = AddUnsigned(c, CC);
		d = AddUnsigned(d, DD);
	}

	var temp = WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d);

	return temp.toLowerCase();
}

exports.sesssion_update_token = async (token) => {
	var uphandle = await this.BfindOneAndUpdate(session_model, { token: token }, { intimestamp: this.get_timestamp() });
	if (uphandle) {
		return true
	} else {
		return false
	}
}

exports.BfindOne = async (model, condition = {}) => {
	try {
		var outdata = null;
		await model.findOne(condition).then(rdata => {
			if (!rdata) {
				outdata = false;
			} else {
				outdata = rdata;
			}
		});
		return outdata;
	} catch (e) {
		return false;
	}
}

exports.BfindOneSelect = async (model, condition = {}, select = "") => {
	try {
		var outdata = null;
		await model.findOne(condition, select).then(rdata => {
			if (!rdata) {
				outdata = false;
			} else {
				outdata = rdata;
			}
		});
		return outdata;
	} catch (e) {
		return false;
	}
}


exports.BfindOneAndUpdate = async (model, condition = {}, data) => {
	// try{
	var updatehandle = await model.findOneAndUpdate(condition, data, { new: true, upsert: true, })
	if (!updatehandle) {
		return false
	} else {
		return updatehandle
	}
	// }catch(e){
	// 	return false;
	// }
}

exports.BfindOneAndDelete = async (model, condition) => {
	try {
		var deletehandle = null;
		await model.findOneAndDelete(condition).then(rdata => {
			deletehandle = rdata;
		});
		if (!deletehandle) {
			return false;
		} else {
			return deletehandle;
		}
	} catch (e) {
		return false;
	}
}

exports.imageupload = (req, res, next) => {
	if (req.files && req.files.length) {
		var filename = req.files[0].filename;
		var filetype = req.files[0].mimetype.split("/")[1];
		var now_path = config.BASEURL + filename;
		var new_path = config.BASEURL + filename + "." + filetype;
		fs.rename(now_path, new_path, (err) => {
			if (err) {
				req.body.imagesrc = false;
			} else {
				var img = filename + "." + filetype;
				req.body.imagesrc = img;
				next();
			}
		});
	} else {
		req.body.imagesrc = false;
		next();
	}
}


exports.appupload = (req, res, next) => {

	if (req.files && req.files.length) {
		var filename = req.files[0].filename;
		var now_path = config.APPURL + filename;
		var apkname = req.body.apkUrl;
		var new_path = config.APPURL + apkname;
		fs.rename(now_path, new_path, (err) => {
			if (err) {
				next();
			} else {
				next();
			}
		});
	} else {
		next();
	}
}

exports.get_timestamp = () => {
	return (new Date()).valueOf();
}

exports.player_balanceupdatein_Username = async (amount, username) => {
	var outdata = await this.BfindOneAndUpdate(playersUser, { username: username }, { $inc: { balance: amount } })
	if (!outdata) {
		return false;
	} else {
		return this.getPlayerBalanceCorrect(outdata);
	}
}

exports.player_Bonusupdatein_Username = async (amount, username) => {
	var outdata = await this.BfindOneAndUpdate(playersUser, { username: username }, { $inc: { bonusbalance: amount } })
	if (!outdata) {
		return false;
	} else {
		return this.getPlayerBalanceCorrect(outdata);
	}

}

//url parse 

exports.urlparse = (adr) => {
	var q = url.parse(adr, true);
	var qdata = q.query;
	return qdata;
}

// updated balance by email
exports.email_balanceupdate = async (email, amount, wallets) => {
	var outdata = await this.BfindOneAndUpdate(playersUser, { email: email }, { $inc: { balance: amount } })
	if (!outdata) {
		return false;
	} else {
		var row = Object.assign({}, wallets, { updatedbalance: this.getPlayerBalanceCorrect(outdata) });
		this.save_wallets_hitory(row);
		return this.getPlayerBalanceCorrect(outdata);
	}

}

// updated bonusbalance by email
exports.email_bonusbalanceupdate = async (email, amount, wallets) => {
	var outdata = await this.BfindOneAndUpdate(playersUser, { email: email }, { $inc: { bonusbalance: amount } })
	if (!outdata) {
		return false;
	} else {

		var row = Object.assign({}, wallets, { updatedbalance: this.getPlayerBonusBalanceCorrect(outdata) });
		this.save_Bonuswallets_hitory(row);
		return this.getPlayerBonusBalanceCorrect(outdata);
	}

}

// exports.save_wallets_hitory = async (rows) => {
// 	if (rows.debited == 0 && rows.credited == 0) {
// 	} else {
// 		var dd = await this.data_save(rows, wallethistory_model);
// 	}
// 	return true
// }

exports.userid_balanceupdate = async (userid, amount) => {
	var outdata = await this.BfindOneAndUpdate(playersUser, { id: userid }, { $inc: { balance: amount } })
	if (!outdata) {
		return false;
	} else {
		return this.getPlayerBalanceCorrect(outdata);
	}
}

exports.email_balanceandbonusupdate = async (email, amount, bonusamount) => {
	var outdata = await this.BfindOneAndUpdate(playersUser, { email: email }, { $inc: { bonusbalance: amount } })
	if (!outdata) {
		return false;
	} else {
		return this.getPlayerBalanceCorrect(outdata);
	}
}

exports.array_sort = (data, handle) => {
	var rows = [];
	for (var i = 0; i < data.length; i++) {
		data[i][handle] = i + 1;
		rows.push(data[i]);
	}
	return rows;
}

exports.sendRequest = async (body, key, callback) => {
	// try {
	const instance = axios.create({
		headers: key ? EXCHGCONFIG.SECUREBASEHEADER : EXCHGCONFIG.BASEHEADER,
	});
	var Response = await instance.post(key ? EXCHGCONFIG.SecureService : EXCHGCONFIG.ReadOnlyService, body);
	if (Response.data) {
		parser.parseString(Response.data, (err, data) => {
			if (err) {
				callback(false);
			} else {
				callback(data['soap:Envelope']['soap:Body'][0]);
			}
		})
	} else {
		callback(false);
	}
	// }catch(err){
	// 	callback(false);
	// }
}

exports.player_balanceupdatein_Id = async (amount, username, wallets) => {
	var amount = parseFloat(amount);
	var outdata = await playersUser.findOneAndUpdate({ id: username }, { $inc: { balance: amount } }, { new: true, upsert: true });
	if (!outdata) {
		return false;
	} else {
		// var row = Object.assign({}, wallets, { updatedbalance: outdata.balance });
		var row = Object.assign({}, wallets, { updatedbalance: outdata.balance + outdata.bonusbalance });
		this.save_wallets_hitory(row);
		this.sesssion_update_id(username);
		return outdata.balance + outdata.bonusbalance;
	}
}

exports.save_wallets_hitory = async (rows) => {
	if (rows.debited == 0 && rows.credited == 0) {
	} else {
		let outdata = await GamePlay.findOne({ id: rows.userid })
		let bonus = this.getPlayerBonusBalanceCorrect(outdata)
		let row = Object.assign({}, rows, { lastBonusBalance: bonus, updateBonusBalance: bonus });
		await this.data_save(row, wallethistory_model);
	}
	return true
}

exports.save_Bonuswallets_hitory = async (rows) => {
	if (rows.debited == 0 && rows.credited == 0) {
	} else {
		let outdata = await GamePlay.findOne({ id: rows.userid })
		let balance = this.getPlayerBalanceCorrect(outdata)
		let row = Object.assign({}, rows, { lastbalance: balance, updatedbalance: balance });
		await this.data_save(row, wallethistory_model);
	}
	return true
}

exports.sesssion_update_id = async (id) => {
	var uphandle = await this.BfindOneAndUpdate(session_model, { id }, { inittime: this.get_timestamp() });
	if (uphandle) {
		return true
	} else {
		return false
	}
}

exports.getSportsBalance = async (userid) => {
	let player = await this.BfindOne(GamePlay, { id: userid });
	return player.balance;
}