const axios = require('axios');
const host = "https://bfrates.com"
const agentcode = "kasagames"
const secretkey = "C52D61817DEBFAA6546E4C2916C6DA0A77A9082E4DEAA176A4E8EE115745F4EF"
const BaseControl = require("./basecontroller")
const {betfairtoken} = require("../models/betfairmodel")


async function settoken () {

    // console.log("--start")
    var data = {
        agentcode:agentcode,
        secretkey:secretkey
    }
    
    var config = {
      method: 'post',
      url: `${host}/api/get_access_token`,
      headers: { },
      data : data
    };
    let token = false
    
    await axios(config)
    .then( async function (response) {
        console.log(response.data)
        if (response.data) {
            await betfairtoken.deleteOne()
            let d = await BaseControl.data_save( {token: response.data.token} ,betfairtoken)
            token = response.data.token
        } else {
            
        }
    })
    .catch(function (error) {
    });
    return token
}

async function gettoken() {
    let d = await betfairtoken.findOne({})
    if (d) {
        return d.token
    } else {
        return false
    }
}

run()

async function run() {
    console.log("ok")
    // let d = await settoken()
    let d = await gettoken()
    console.log(d)

    
}