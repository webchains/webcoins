const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');

const TransactionSchema = new mongoose.Schema({
    fromAddress: String,
    toAddress: String,
    amount: Number,
    hash: String,
    signature: String
}, {timestamps: {createdAt: true}});

TransactionSchema.plugin(mongoosePaginate);
TransactionSchema.index({hash: 'text'});

const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = Transaction;