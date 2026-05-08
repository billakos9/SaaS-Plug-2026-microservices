import mongoose from "mongoose";

const ProviderSchema = new mongoose.Schema(
  {
    providerId: {
      type: Number,
      required: true,
      unique: true,
    },
    providerName: {
      type: String,
      required: true,
    },
    apiBaseUrl: {
      type: String,
      required: true,
    },
    apiKey: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    }
  },
  { timestamps: true },
);


/**
 * Mongoose Model for Provider collection
 */
const Provider = mongoose.model("Provider", ProviderSchema);

export default Provider;
