const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');

const TreeSchema = new mongoose.Schema({
    blockIndex: Number,
    blockPreviousHash: String,
    blockHash: String,
    transactionLeaves: Array,
    transactionRoot: String,
    hash: String
}, {timestamps: {createdAt: true}});

TreeSchema.plugin(mongoosePaginate);
TreeSchema.index({hash: 'text'});

const Tree = mongoose.model('Tree', TreeSchema);

module.exports = Tree;