 // mongose is needed here for the definition
 var mongoose = require('mongoose');
 var Schema = mongoose.Schema;


 module.exports = {
    fairbets:{ // database

      
        matka_betmodel : new Schema({
            DATE: { type: Date },
            createdAt: { type: Date },
            amount: { type: Number, required : true },
            winamount: { type: Number, required : true },
            
            betnumber: { type: String, required : true },
            bazaarid: { 
                type: Schema.Types.ObjectId, ref: 'matka_Bazaar'
            },
            gameid: { 
                type: Schema.Types.ObjectId, ref: 'matka_Game'
            },
            roundid: { type: String, required : true },
            transactionid: { type: String, required : true },
            detail : { type: Object, default : {} },
            status: { type: String, required : true },
            time_flag : {type : String,required : true},
            userid: {
                type: Schema.Types.ObjectId, ref: 'user_users'
            },
            type : {type: String,},
            name : {type: String,},
            
        }),
        matka_Bazaar : new Schema({
            bazaarname : {type : String,required : true},
            bazaartype : {type : String,required : true},
            ownership : {type : String,required : true},
            status : {type : Boolean,default : false},
            postCalled : {type : String,required : true},
            timers : {type : Object,required : true},
            updated_at: { type: Date, },
            gamelink : {type : Object,default :{}},
            resultmode : { type : Boolean , default : false},
            week : { type : Object , default : {}},
            blocktime : { type : Number , default : 0},
            hightlight : { type : Boolean , default : false},
            notification : { type : Boolean , default : false},
            isdelete : { type : Boolean , default : false}
        }),
        matka_result : new Schema({
            jodiresult: { type: String,  },
            closeresult: { type: String,  },
            openresult: { type: String,  },
            startLinetimer : {type : String },
            bazaarid: { 
                type: Schema.Types.ObjectId, ref: 'matka_Bazaar' 
            },
            bazaartype: { type: String, required : true },
            resultdate: { type: Date, required : true },
            // userid: {
            //     type: Schema.Types.ObjectId, ref: 'user_users'
            // },
            DATE: { type: Date, },
            update :{type : Boolean,default : false}
        })

     },

     starkasino:{ // database

        matka_betmodel : new Schema({
            DATE: { type: Date },
            createdAt: { type: Date },
            amount: { type: Number, required : true },
            winamount: { type: Number, required : true },
            
            betnumber: { type: String, required : true },
            bazaarid: { 
                type: Schema.Types.ObjectId, ref: 'matka_Bazaar'
            },
            gameid: { 
                type: Schema.Types.ObjectId, ref: 'matka_Game'
            },
            roundid: { type: String, required : true },
            transactionid: { type: String, required : true },
            detail : { type: Object, default : {} },
            status: { type: String, required : true },
            time_flag : {type : String,required : true},
            userid: {
                type: Schema.Types.ObjectId, ref: 'user_users'
            },
            type : {type: String,},
            name : {type: String,},
            
        }),
        matka_Bazaar : new Schema({
            bazaarname : {type : String,required : true},
            bazaartype : {type : String,required : true},
            ownership : {type : String,required : true},
            status : {type : Boolean,default : false},
            postCalled : {type : String,required : true},
            timers : {type : Object,required : true},
            updated_at: { type: Date, },
            gamelink : {type : Object,default :{}},
            resultmode : { type : Boolean , default : false},
            week : { type : Object , default : {}},
            blocktime : { type : Number , default : 0},
            hightlight : { type : Boolean , default : false},
            notification : { type : Boolean , default : false},
            isdelete : { type : Boolean , default : false}
        }),
        matka_result : new Schema({
            jodiresult: { type: String,  },
            closeresult: { type: String,  },
            openresult: { type: String,  },
            startLinetimer : {type : String },
            bazaarid: { 
                type: Schema.Types.ObjectId, ref: 'matka_Bazaar' 
            },
            bazaartype: { type: String, required : true },
            resultdate: { type: Date, required : true },
            // userid: {
            //     type: Schema.Types.ObjectId, ref: 'user_users'
            // },
            DATE: { type: Date, },
            update :{type : Boolean,default : false}
        })
         // this collection "files" will be gridfs
     }
    
 };