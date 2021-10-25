const gamesessionmodel = require("../models/users_model").gamesessionmodel;
const usersession = require("../models/users_model").sessionmodel;
const usersessionmodel = require("../models/users_model").usersessionmodel
const adminUser = require("../models/users_model").adminUser
const { betfairoddsSession } = require("../models/betfairmodel")
const BASECONTROL = require("../controller/basecontroller");
const { getExpoSureCountFromPlayer } = require("../controller/userscontroller");
const { PaymoroSubmitData } = require("../models/paymentGateWayModel")
const Homeconfig = require("../config/index.json")
const BetfairbControl = require("../controller/betfairController")

module.exports = async (io) => {
    io.on("connection", async (socket) => {
        let query = socket.handshake.query;
        // let uniqueid = socket.handshake.query.uniqueid;

        if (query.auth) {
            let socketid = socket.id;
            var user = BASECONTROL.decrypt(query.auth);
            if (user) {
                user = JSON.parse(user);
                let row = {
                    id: user._id,
                    socketid: socketid,
                    chatid: "web",
                    auth: query.auth
                }

                if (user.role == Homeconfig.USERS.player) {
                    let last = await usersession.findOne({ id: user._id }).populate('id')
                    if (last && last.auth != row.auth) {
                        await BASECONTROL.BfindOneAndDelete(usersession, { id: user._id })
                        await BASECONTROL.BfindOneAndDelete(usersessionmodel, { id: user._id });
                        await BASECONTROL.BfindOneAndDelete(gamesessionmodel, { id: user._id });

                        let expires = {}
                        expires[last.id.email] = true
                        io.sockets.emit('destory', { data: expires });

                    } else {
                        let dd = await BASECONTROL.BfindOneAndUpdate(usersession, {
                            id: user._id
                        }, row);
                    }
                } else {
                    let dd = await BASECONTROL.BfindOneAndUpdate(usersession, {
                        id: user._id
                    }, row);
                }
            }
        }
        if (query.uniqueid) {
            await betfairoddsSession.findOneAndUpdate({ uniqueid: query.uniqueid }, {socketid: socket.id})
        }

        socket.on("setTelegram", async rdata => {
            let user = await adminUser.findOne({ email: rdata.telegram_id });
            if (user) {
                let row = {
                    chatid: rdata.chat_id,
                    id: user._id,
                    socketid: socket.id
                }
                let dd = await BASECONTROL.BfindOneAndUpdate(usersession, {
                    id: user._id
                }, row);
            }
        })

        socket.on("setsession", async (rdata) => { });
        socket.on("setoddsSession", async (rdata) => {
            let inittime = new Date(new Date().valueOf() + 12 * 60 * 60 * 1000)
            
            let row = {
                socketid: socket.id,
                date: inittime,
                uniqueid: query.uniqueid
            }
            row = {...row, ...rdata.data}
            
            await BASECONTROL.BfindOneAndUpdate(betfairoddsSession, { socketid: row.socketid }, row,)
        });
        socket.on("destryoddsSession", async (rdata) => {
            await BASECONTROL.BfindOneAndDelete(betfairoddsSession, { socketid: socket.id })
        });

        socket.on("sessiondestroy", async (rdata) => {
            var user = BASECONTROL.decrypt(rdata.token);
            if (rdata.token && user) {
                user = JSON.parse(user);
                await BASECONTROL.BfindOneAndDelete(usersession, { id: user._id });
                await BASECONTROL.BfindOneAndDelete(usersessionmodel, { id: user._id });
            }
        })

        socket.on("gamesavetoken", async (rdata) => {
            var find = await BASECONTROL.BfindOneAndUpdate(gamesessionmodel, { email: rdata.email }, rdata);
            if (!find) {
                socket.emit("gamedestory", { data: false })
            }
        });

        socket.on("gamedelete", async (rdata) => {
            await gamesessionmodel.findOneAndDelete({ token: rdata.data.token })
            // await gamesessionremove(rdata.data);
        });

        socket.on("disconnect", async () => {
            let socketid = socket.id
            // await BASECONTROL.BfindOneAndDelete(betfairoddsSession, { socketid: socket.id })
            let dd = await BASECONTROL.BfindOneAndDelete(usersession, { socketid: socketid })
            if (dd) {
                await BASECONTROL.BfindOneAndDelete(usersessionmodel, { id: dd.id })
            }

        })
    });

    setInterval(() => {
        io.sockets.emit('datetime', {
            offset: new Date().getTimezoneOffset(),
            toDateString: new Date().toDateString(),
            toLocaleTimeString: new Date().toLocaleTimeString(),
            toTimeString: new Date().toTimeString(),
            getTime: new Date().getTime(),
        });

    }, 1000);
    setInterval( () => {
         BetfairbControl.RealtimeUpdatingOddsExChangeData(io)
    }, 700);

    setInterval(async () => {

            var gameSession = await gamesessionmodel.find({ intimestamp: { $lte: new Date() } });
            if (gameSession.length) {
                await gamesessionmodel.deleteMany({ intimestamp: { $lte: new Date() } });
    
                var Gexpires = {};
                for (var i in gameSession) {
                    Gexpires[gameSession[i]['email']] = true;
                }
                if (Object.keys(Gexpires).length) {
                    io.sockets.emit('expiredestory', { data: Gexpires });
                }
    
            }
    
            let siPlayers = await usersession.find().populate("id");
            if (siPlayers.length) {
                let expires = {}
                for (var i in siPlayers) {
    
                    if (siPlayers[i]['id']['status'] === "allow") {
                        let balances = {};
                        balances[siPlayers[i]['id']['email']] = BASECONTROL.getPlayerBalanceCal_(siPlayers[i]['id']['playerid']);
                        let expo = await getExpoSureCountFromPlayer(siPlayers[i]['id']['_id'])
                        balances[siPlayers[i]['id']['email']]['exposure'] = expo
                        io.to(siPlayers[i].socketid).emit("balance", { data: balances });
                    } else {
                        expires[siPlayers[i]['id']['email']] = true;
                        io.to(siPlayers[i].socketid).emit("destory", { data: expires });
                        await usersession.findOneAndDelete({ id: siPlayers[i]['id']['_id'] });
                        await gamesessionmodel.findOneAndDelete({ id: siPlayers[i]['id']['_id'] });
                        await usersessionmodel.findOneAndDelete({ id: siPlayers[i]['id']['_id'] });
                    }
    
                }
                // io.sockets.emit('destory', { data: expires });
                // io.sockets.emit('balance', { data: balances });
            }
    
            await PaymoroSubmitData.deleteMany({ date: { $lte: new Date() } });
            await betfairoddsSession.deleteMany({ date: { $lte: new Date() } });
    
            var userSession = await usersessionmodel.find({ inittime: { $lte: new Date() } }).populate("id");
            if (userSession.length) {
                await usersessionmodel.deleteMany({ inittime: { $lte: new Date() } });
                var expires = {}
                for (var i in userSession) {
                    expires[userSession[i]['id']['email']] = true;
                    await usersession.findOneAndDelete({ id: userSession[i]['id']['_id'] });
                }
                if (Object.keys(expires).length) {
                    io.sockets.emit('destory', { data: expires });
                }
            }


    }, 5000);
};
