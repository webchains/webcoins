const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');

const PostSchema = new mongoose.Schema({
    title: String,
    text: String,
    media: String,
    reply: Array
}, {timestamps: {createdAt: true}});

PostSchema.plugin(mongoosePaginate);
PostSchema.index({id: 'text'});

const Post = mongoose.model('Post', PostSchema);

module.exports = Post;