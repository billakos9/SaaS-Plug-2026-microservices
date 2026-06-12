import ProviderService from "../services/provider.service.js";
import {
  toProviderListDTO,
  toProviderDetailDTO,
  toProviderRegisteredDTO,
  toProviderRegistrationRequestDTO,
  toProviderUpdateRequestDTO,
  toProviderUpdatedDTO,
} from "../dto/provider.dto.js";

/**
 * Handles GET /
 * Returns all registered providers (public fields only — no password or apiKey).
 *
 * @param {import("express").Request} req - The incoming HTTP request.
 * @param {import("express").Response} res - The outgoing HTTP response.
 * @returns {Promise<void>} Responds with an array of provider summary objects.
 */
export const getAllProviders = async (req, res) => {
  const providers = await ProviderService.getAll();
  res.json(toProviderListDTO(providers));
};

/**
 * Handles GET /:id
 * Returns a single provider by numeric id.
 *
 * @param {import("express").Request} req - The incoming HTTP request.
 * @param {import("express").Response} res - The outgoing HTTP response.
 * @returns {Promise<void>} Responds with the matched provider document.
 */
export const getProviderById = async (req, res) => {
  const id = Number(req.params.id);
  const provider = await ProviderService.getById(id);
  res.json(toProviderDetailDTO(provider));
};

/**
 * Handles POST /register
 * Registers a new provider. Returns 201 on success.
 *
 * @param {import("express").Request} req - The incoming HTTP request.
 * @param {import("express").Response} res - The outgoing HTTP response.
 * @returns {Promise<void>} Responds with the registration confirmation DTO.
 */
export const registerProvider = async (req, res) => {
  const providerData = toProviderRegistrationRequestDTO(req.body);
  const newProvider = await ProviderService.registerProvider(providerData);
  res.status(201).json(toProviderRegisteredDTO(newProvider));
};

/**
 * Handles PUT /update/:id
 * Partially updates an existing provider.
 *
 * @param {import("express").Request} req - The incoming HTTP request.
 * @param {import("express").Response} res - The outgoing HTTP response.
 * @returns {Promise<void>} Responds with the updated provider DTO.
 */
export const updateProvider = async (req, res) => {
  const providerData = toProviderUpdateRequestDTO(req.params.id, req.body);
  const updatedProvider = await ProviderService.updateProvider(providerData);
  res.json(toProviderUpdatedDTO(updatedProvider));
};

/**
 * Handles DELETE /delete/:id
 * Deletes an existing provider by numeric id.
 *
 * @param {import("express").Request} req - The incoming HTTP request.
 * @param {import("express").Response} res - The outgoing HTTP response.
 * @returns {Promise<void>} Responds with the deletion result object.
 */
export const deleteProvider = async (req, res) => {
  const providerId = Number(req.params.id);
  const result = await ProviderService.deleteProvider(providerId);
  res.json(result);
};
