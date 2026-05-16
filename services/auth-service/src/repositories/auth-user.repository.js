import AuthUser from "../models/auth-user.model.js";
import Counter from "../models/counter-model.js";

class AuthUserRepository {
  static async getNextId() {
    const counter = await Counter.findByIdAndUpdate(
      "userId",
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
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
}

export default AuthUserRepository;
