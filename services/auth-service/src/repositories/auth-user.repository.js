import AuthUser from "../models/auth-user.model.js";
import Counter from "../models/counter-model.js";

class AuthUserRepository {
  static async getNextId() {
    const counter = await Counter.findByIdAndUpdate(
      "userId",
      { $inc: { seq: 1 } },
      { returnDocument: "after", upsert: true },
    );

    return counter.seq;
  }

  static async findByEmail(email) {
    return AuthUser.findOne({ email: email.toLowerCase().trim() }).lean();
  }

  static async findById(userId) {
    return AuthUser.findOne({ userId }).lean();
  }

  static async create(authUserData) {
    const authUser = await AuthUser.create(authUserData);
    return authUser.toObject();
  }

  static async update(userId, updateData) {
    return AuthUser.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { returnDocument: "after", runValidators: true }
    ).lean();
  }

  static async deleteByEmail(email) {
    return AuthUser.findOneAndDelete({ email: email.toLowerCase() }).lean();
  }
}

export default AuthUserRepository;
