const bcrypt = require("bcrypt");
const { check } = require("express-validator");
const config = require("../config/config");
const commonStrings = require("../config/languages/locales/es.json").common;
const jwt = require("jsonwebtoken");
const BadRequestError = require("../config/common/error/bad_request_error");
const User = require("../models/user");

const privileges = {
  admin: {
    privilege: config.privileges.admin,
    allowedPlatform: config.request.headers.platform.web
  },
  employee: {
    privilege: config.privileges.employee,
    allowedPlatform: config.request.headers.platform.mobile
  },
};

const authValidators = [
  check("email")
    // .notEmpty()
    // .withMessage(commonStrings.error.wrongCredentials)
    // .isEmail()
    // .withMessage(commonStrings.error.wrongCredentials)
    .custom(async (value, { req }) => {
      const user = await User.findOne({ email: value });
      console.log("111");
      if (!user) {
        throw new BadRequestError(commonStrings.error.wrongCredentials);
      }

      console.log("222");
      const domain = value.split("@")[1];
      if (domain !== config.domains.email) {
        throw new BadRequestError(commonStrings.error.wrongCredentials);
      }

      return true;
    }),
  check("password")
    // .notEmpty()
    // .withMessage(commonStrings.error.password.empty)
    // .isLength({ min: 12 })
    // .withMessage(commonStrings.error.password.minLenght)
    // .matches(/[a-z]/)
    // .withMessage(commonStrings.error.password.lowercaseLetter)
    // .matches(/[A-Z]/)
    // .withMessage(commonStrings.error.password.uppercaseLetter)
    // .matches(/[0-9]/)
    // .withMessage(commonStrings.error.password.number)
    // .matches(/[!@#$%^&*(),.?":{}|<>]/)
    // .withMessage(commonStrings.error.password.specialCharacter)
    .custom(async (value, { req }) => {
      const user = await User.findOne({ email: req.body.email });
      const passwordMatch = await bcrypt.compare(value, user.password);

      console.log("333");
      if (!passwordMatch) {
        throw new BadRequestError(commonStrings.error.wrongCredentials);
      }

      console.log("444");
      return true;
    }),
  check("").custom(async (value, { req }) => {    
    const user = await User.findOne({ email: req.body.email });
    const platform = req.headers['x-platform']; 

    console.log(user);
    console.log(platform);

    console.log("555");
    if (
      (user.privilege === privileges.admin.privilege && platform !== privileges.admin.allowedPlatform) || 
      (user.privilege === privileges.employee.privilege && platform !== privileges.employee.allowedPlatform)
    ) {
      throw new BadRequestError(commonStrings.error.wrongCredentials);
    }

    console.log("666");
    return true;
  }),
];

async function login(req, res, next) {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return next(new BadRequestError(commonStrings.error.wrongCredentials));
    }

    const pwdEqual = await bcrypt.compare(password, user.password);
    if (!pwdEqual) {
      return next(new BadRequestError(commonStrings.error.wrongCredentials));
    }

    const platform = req.headers['x-platform']; 
    if (
      (user.privilege === privileges.admin.privilege && platform !== privileges.admin.allowedPlatform) || 
      (user.privilege === privileges.employee.privilege && platform !== privileges.employee.allowedPlatform)
    ) {
      throw new BadRequestError(commonStrings.error.wrongCredentials);
    }

    // Generating authentiation token.
    const token = jwt.sign(
      { email, userId: user._id },
      config.tokens.secretKey,
      { expiresIn: "5h" }
    );

    // Saving user's cookies.
    /*
        const cookieOption = {
            expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
            path: "/",
            httpOnly: true, // No accesible desde el cliente (JavaScript)
            secure: process.env.NODE_ENV === 'production', // Solo para HTTPS en producción
            sameSite: 'None', // Permite cookies entre sitios en el navegador
            maxAge: 24 * 60 * 60 * 1000 // Tiempo de vida de la cookie
        }
        res.cookie("new", token, cookieOption);
        console.log("Res.cookie: ", res.cookie);
        */

    req.session = {
      token,
      firstName: user.firstName,
      fisrtLastName: user.firstLastName,
      secondLastName: user.secondLastName,
      email: user.email,
      privilege: user.privilege,
    };

    console.log("Usuario logeado con éxito");
    res.status(200).json({ success: true, token: req.session.token });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  req.session = null;
  console.log("Successfully logged out");
  res.status(200).json({ success: true, message: "Successfully logged out" });
}

module.exports = {
  authValidators,
  login,
  logout,
};
