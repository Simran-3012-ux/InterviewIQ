const mongoose = require('mongoose');


const blacklistSTokenSchema = new mongoose.Schema({
    token:{
        type: String,
        required:[true, 'Token is required'],
    }
},{
    timestamps: true
})

const blacklistTokenModel = mongoose.model('blacklistToken', blacklistSTokenSchema)

module.exports = blacklistTokenModel


    