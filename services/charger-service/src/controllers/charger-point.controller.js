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
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON response with charger point or null
 */
export const getChargerPointById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const chargerPoint = await ChargerPointService.getById(id);

    if (!chargerPoint) return res.status(404).json({ message: "Charger not found" });

    res.json(toChargerPointDTO(chargerPoint));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles GET /
 * Retrieves all charger points
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON array of charger points
 */
export const getAllChargerPoints = async (req, res, next) => {
  try {
    const chargerPointList = await ChargerPointService.getAll();

    res.json(toChargerPointDTOList(chargerPointList));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles GET /
 * Retrieves all charger points with specific status
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON array of charger points
 */
export const getAllChargerPointsByStatus = async (req, res, next) => {
  try {
    const chargerPointList = await ChargerPointService.getAllByStatus(req.params.status);

    res.json(toChargerPointDTOList(chargerPointList));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles GET /:lat/:lon
 * Retrieves charger points matching exact coordinates
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON array of matching charger points
 */
export const getChargerPointByLocation = async (req, res, next) => {
  try {
    const { lat, lon, radius } = req.params;
    const radiusKm = radius ? Number(radius) : undefined;
    const chargerPointList = await ChargerPointService.getByLocation(lat, lon, radiusKm);

    res.json(toChargerPointDTOList(chargerPointList));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles POST /
 * Creates a new charger point
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Sends JSON of created charger point
 */
export const addChargerPoint = async (req, res, next) => {
  try {
    const chargerPointDto = toChargerPointDTO(req.body);
    const resultChargerPoint = await ChargerPointService.create(chargerPointDto);

    res.json(toChargerPointDTO(resultChargerPoint));
  } catch (err) {
    next(err);
  }
};
