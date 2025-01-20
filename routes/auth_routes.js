const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth_controller');
const validationRequest = require('../config/common/middlewares/validation_request');

router.post("/login", authController.authValidators, validationRequest, authController.login);
router.all("/logout", authController.logout);

module.exports = router;