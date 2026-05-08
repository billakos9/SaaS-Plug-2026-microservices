import {
  toChargerPointDTO,
  toChargerPointDTOList,
} from "../dto/chargerPoint.dto.js";
import ChargerPointService from "../services/charger-point.service.js";

/**
 * Handles GET /:id
 * Retrieves a single charger point by its numeric id
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON response with charger point or null
 */
export const getChargerPointById = async (req, res) => {
  const id = Number(req.params.id);

  const chargerPoint = await ChargerPointService.getById(id);

  if (!chargerPoint) return res.status(404).json({ message: "Charger not found" });

  res.json(toChargerPointDTO(chargerPoint));
};

/**
 * Handles GET /
 * Retrieves all charger points
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON array of charger points
 */
export const getAllChargerPoints = async (req, res) => {
  const chargerPointList = await ChargerPointService.getAll();

  res.json(toChargerPointDTOList(chargerPointList));
};

/**
 * Handles GET /
 * Retrieves all charger points with specific status
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON array of charger points
 */
export const getAllChargerPointsByStatus = async (req, res) => {
  const chargerPointList = await ChargerPointService.getAllByStatus(req.params.status);

  res.json(toChargerPointDTOList(chargerPointList));
};

/**
 * Handles GET /:lat/:lon
 * Retrieves charger points matching exact coordinates
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON array of matching charger points
 */
export const getChargerPointByLocation = async (req, res) => {
  const { lat, lon, radius } = req.params;
  const radiusKm = radius ? Number(radius) : undefined;
  const chargerPointList = await ChargerPointService.getByLocation(lat, lon, radiusKm);

  res.json(toChargerPointDTOList(chargerPointList));
};

/**
 * Handles POST /
 * Creates a new charger point
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON of created charger point
 */
export const addChargerPoint = async (req, res) => {
  const chargerPointDto = toChargerPointDTO(req.body);
  const resultChargerPoint = await ChargerPointService.create(chargerPointDto);

  res.json(toChargerPointDTO(resultChargerPoint));
};
