import Counter from "../models/counter.model.js";
import Provider from "../models/provider.model.js";

class ProviderRepository {
  /**
   * Atomically increments the providerId counter and returns the new value.
   *
   * Uses a MongoDB findOneAndUpdate with upsert so the counter document is
   * created on first call and every subsequent call receives a unique integer.
   *
   * @returns {Promise<number>} The next available provider id.
   */
  static async getNextId() {
    const counter = await Counter.findByIdAndUpdate(
      "providerId",
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    return counter.seq;
  }

  /**
   * Returns all provider documents as plain JavaScript objects.
   *
   * @returns {Promise<Object[]>} Array of all provider records (lean, no Mongoose overhead).
   */
  static async getAll() {
    return Provider.find().lean();
  }

  /**
   * Finds a single provider by its numeric id.
   *
   * @param {number} providerId - The numeric id of the provider to look up.
   * @returns {Promise<Object|null>} The matching provider object, or null if not found.
   */
  static async getById(providerId) {
    return Provider.findOne({ providerId }).lean();
  }

  /**
   * Persists a new provider document to the database.
   *
   * @param {Object} providerData - The provider data object including the assigned providerId.
   * @returns {Promise<Object>} The created Mongoose document.
   */
  static async create(providerData) {
    return Provider.create(providerData);
  }

  /**
   * Applies a partial update to an existing provider and returns the updated document.
   *
   * @param {Object} updatedProviderData - Object containing `providerId` plus any fields to update.
   * @param {number} updatedProviderData.providerId - Id of the provider to update.
   * @returns {Promise<Object|null>} The updated provider as a plain object, or null if not found.
   */
  static async update(updatedProviderData) {
    const { providerId, ...updateData } = updatedProviderData;
    const result = await Provider.findOneAndUpdate(
      { providerId },
      { $set: updateData },
      { new: true },
    ).lean();
    return result;
  }

  /**
   * Deletes the provider document matching the given id.
   *
   * @param {number} providerId - The numeric id of the provider to delete.
   * @returns {Promise<{ deletedCount: number }>} Mongoose deleteOne result indicating how many documents were removed.
   */
  static async delete(providerId) {
    return Provider.deleteOne({ providerId });
  }
}

export default ProviderRepository;
