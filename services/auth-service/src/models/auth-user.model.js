import mongoose from "mongoose";

const AuthUserSchema = new mongoose.Schema({
    userId: {
        type: Number,
        required: true,
        unique: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ["user", "provider", "admin"],
        default: "user",
    },
});

export default mongoose.model(
    "AuthUser",
    AuthUserSchema
);
