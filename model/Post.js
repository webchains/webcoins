const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');

const PostSchema = new mongoose.Schema({
    address: String,
    text: String,
    media: String
}, {timestamps: {createdAt: true}});

PostSchema.plugin(mongoosePaginate);
PostSchema.index({id: 'text'});

const Post = mongoose.model('Post', PostSchema);

module.exports = Post;