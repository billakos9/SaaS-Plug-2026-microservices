import ManagementService from "../services/management.service.js";

// ── Providers ────────────────────────────────────────────────────────────────

/**
 * Handles GET /admin/management/providers
 * Returns all providers from the provider service.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON array of provider objects
 */
export const getAllProviders = async (req, res, next) => {
  try {
    res.json(await ManagementService.getAllProviders(req.headers["authorization"]));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles GET /admin/management/providers/:id
 * Returns a single provider by its ID from the provider service.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON object of the matching provider
 */
export const getProviderById = async (req, res, next) => {
  try {
    res.json(await ManagementService.getProviderById(req.params.id, req.headers["authorization"]));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles POST /admin/management/providers/register
 * Creates a new provider by proxying the request to the provider service.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON of the created provider (201)
 */
export const registerProvider = async (req, res, next) => {
  try {
    const result = await ManagementService.registerProvider(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles PUT /admin/management/providers/update/:id
 * Updates an existing provider by proxying the request to the provider service.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON of the updated provider
 */
export const updateProvider = async (req, res, next) => {
  try {
    res.json(await ManagementService.updateProvider(req.params.id, req.body, req.headers["authorization"]));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles DELETE /admin/management/providers/delete/:id
 * Permanently removes a provider by proxying the request to the provider service.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON with the deletion result
 */
export const deleteProvider = async (req, res, next) => {
  try {
    res.json(await ManagementService.deleteProvider(req.params.id, req.headers["authorization"]));
  } catch (err) {
    next(err);
  }
};

// ── Users ─────────────────────────────────────────────────────────────────

/**
 * Handles GET /admin/management/users
 * Returns all users from the user service.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON array of user objects
 */
export const getAllUsers = async (req, res, next) => {
  try {
    res.json(await ManagementService.getAllUsers(req.headers["authorization"]));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles GET /admin/management/users/:id
 * Returns a single user by their ID from the user service.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON object of the matching user
 */
export const getUserById = async (req, res, next) => {
  try {
    res.json(await ManagementService.getUserById(req.params.id, req.headers["authorization"]));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles DELETE /admin/management/users/delete/:id
 * Permanently removes a user by proxying the request to the user service.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON with the deletion result
 */
export const deleteUser = async (req, res, next) => {
  try {
    res.json(await ManagementService.deleteUser(req.params.id, req.headers["authorization"]));
  } catch (err) {
    next(err);
  }
};

// ── Chargers ──────────────────────────────────────────────────────────────

/**
 * Handles GET /admin/management/chargers
 * Returns all charger points from the charger service.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON array of charger objects
 */
export const getAllChargers = async (req, res, next) => {
  try {
    res.json(await ManagementService.getAllChargers());
  } catch (err) {
    next(err);
  }
};

/**
 * Handles GET /admin/management/chargers/:id
 * Returns a single charger point by its ID from the charger service.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON object of the matching charger
 */
export const getChargerById = async (req, res, next) => {
  try {
    res.json(await ManagementService.getChargerById(req.params.id));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles GET /admin/management/chargers/status/:status
 * Returns all charger points with the given status from the charger service.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON array of chargers matching the status
 */
export const getChargersByStatus = async (req, res, next) => {
  try {
    res.json(await ManagementService.getChargersByStatus(req.params.status));
  } catch (err) {
    next(err);
  }
};
