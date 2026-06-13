import AuthService from "../services/auth.service.js";

export const postLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await AuthService.login(email, password);

    res.json(result);
  } catch(error) {
    next(error);
  }
};

export const getValidate = async (req, res, next) => {
  try {
    const { token } = req.query;

    const result = AuthService.validateToken(token);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const postRegister = async (req, res, next) => {
  try {
    const result = await AuthService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const postRegisterProvider = async (req, res, next) => {
  try {
    const result = await AuthService.registerProvider(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};
