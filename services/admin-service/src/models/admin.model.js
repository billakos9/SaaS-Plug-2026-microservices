import mongoose from "mongoose";

/**
 * Mongoose schema and model for the Admin resource.
 * Enforces unique adminId and email constraints and adds createdAt/updatedAt
 * timestamps automatically.
 */
const AdminSchema = new mongoose.Schema(
  {
    adminId: {
      type:     Number,
      required: true,
      unique:   true,
    },
    firstName: {
      type:     String,
      required: true,
    },
    lastName: {
      type:     String,
      required: true,
    },
    email: {
      type:     String,
      required: true,
      unique:   true,
    },
    password: {
      type:     String,
      required: true,
    },
  },
  { timestamps: true },
);

const Admin = mongoose.model("Admin", AdminSchema);

export default Admin;
