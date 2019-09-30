const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');

const BlockSchema = new mongoose.Schema({
    index: Number,
    previousHash: String,
    nonce: Number,
    hash: String,
    data: Array
}, {timestamps: {createdAt: true}});

BlockSchema.plugin(mongoosePaginate);
BlockSchema.index({hash: 'text'});

const Block = mongoose.model('Block', BlockSchema);

module.exports = Block;