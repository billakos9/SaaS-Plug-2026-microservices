import AuthService from "../services/auth.service.js";

export const postLogin = async (
    req,
    res,
    next
) => {
    try {
        const { email, password } = req.body;

        const result = await AuthService.login(email, password);

        res.json(result);
    } catch(error) {
        next(error);
    }
} ;

export const getValidate = async (
    req,
    res,
    next
) => {
    try {
        const { token } = req.query;

        const result = AuthService.validateToken(token);

        res.json(result);
    } catch (error) {
        next(error);
    }
};

