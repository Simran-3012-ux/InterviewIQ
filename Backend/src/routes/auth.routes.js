const express = require('express');
const authController = require('../controllers/auth.controller');
const authRouter = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 *  @access Public
 */
authRouter.post('/register', authController.registerUserController);

/**
 * @route POST /api/auth/login
 * @desc Login a user with email and password
 * @access Public
 */
authRouter.post('/login', authController.loginUserController);

/**
 * @route GET /api/auth/logout
 * @desc clear token from user cookie and add token in blacklist collection
 * @access Public
 */
authRouter.get('/logout', authController.logoutUserController);
 
/**
 * @route GET /api/auth/get-me
 * @desc get the correct logged in user details
 * @access Private
 */
authRouter.get('/get-me', authMiddleware.authUser, authController.getMeController);

module.exports = authRouter;