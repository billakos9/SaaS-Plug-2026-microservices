import AuthUser from "../models/auth-user.model.js";

class AuthUserRepository {
    static async findByEmail(email) {
        return AuthUser.findOne({ email }).lean();
    }

    static async findById(userId) {
        return AuthUser.findOne({ userId }).lean();
    }
}

export default AuthUserRepository;