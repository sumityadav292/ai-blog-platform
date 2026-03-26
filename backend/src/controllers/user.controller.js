const User = require('../models/User');
const Post = require('../models/Post');

async function listMyPosts(req, res, next) {
  try {
    const posts = await Post.find({ author: req.user.id }).sort('-createdAt');
    res.json({ posts });
  } catch (e) { next(e); }
}

async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) { res.status(404); throw new Error('User not found'); }
    res.json({ user });
  } catch (e) { next(e); }
}

async function listUsers(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({})
        .select('-password')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit),
      User.countDocuments({}),
    ]);

    res.json({ users, total, page, pageSize: limit });
  } catch (e) {
    next(e);
  }
}

async function updateUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const user = await User.findById(id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    user.role = role;
    await user.save();

    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl } });
  } catch (e) {
    next(e);
  }
}

async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Use deleteOne() so schema cascade middleware runs.
    await user.deleteOne();

    res.json({ message: 'User deleted' });
  } catch (e) {
    next(e);
  }
}

module.exports = { listMyPosts, getUserById, listUsers, updateUserRole, deleteUser };


