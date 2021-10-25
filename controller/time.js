var moment = require('moment-timezone');
const fs = require("fs")
const config = require("../db")
var stringify = require('csv-stringify');

exports.Indiatime = () => {
	var time = moment.tz(new Date(), "Asia/Kolkata");
	time.utc("+530").format();
	return time;
}

exports.UTC_4M = () => {
	var time = moment.tz(new Date(), "America/Caracas");
	time.utc("-400").format();
	return time;
}


exports.csvfileexports = (req, res, next) => {
	let filename = req.body.name
	let data = req.body.data
	if ( data && data.length) {
		let row = {}
		for (let i in data[0]) {
			row[i] = i
		}
		data.unshift(row)
		
		filename = filename + new Date().valueOf() + ".csv"
		stringify(data, function (err, output) {
			fs.writeFile(config.BASEURL + filename, output, 'utf8', function (err) {
				if (err) {
					res.send({status : false, data : "fail"})
					return next()
				} else {
					res.send({status : true, data :filename})
					return next()
				}
			});
		});
	} else {
		res.send({status : false, data : "fail"})
		return next()
	}
}
