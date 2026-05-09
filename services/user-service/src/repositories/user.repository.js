import Counter from "../models/counter.model.js";
import User from "../models/user.model.js";

class UserRepository {
  static async getNextId() {
    const counter = await Counter.findByIdAndUpdate(
      "userId",
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    return counter.seq;
  }

  static async getAll() {
    return User.find().lean();
  }

  static async getById(userId) {
    return User.findOne({ userId }).lean();
  }

  static async getByEmail(email) {
    return User.findOne({ email }).lean();
  }

  static async create(userData) {
    const user = await User.create(userData);
    return user.toObject();
  }

  static async update(userData) {
    return User.findOneAndUpdate(
      { userId: userData.userId },
      userData,
      { new: true, runValidators: true },
    ).lean();
  }

  static async delete(userId) {
    return User.deleteOne({ userId });
  }
}

export default UserRepository;
