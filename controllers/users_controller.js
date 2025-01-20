const commonStrings = require("../config/languages/locales/es.json").common;
const config = require("../config/config");
const {check} = require("express-validator");
const BadRequestError = require('../config/common/error/bad_request_error');
const NotFoundError = require('../config/common/error/not_found_error');
const User = require('../models/user');

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

const createUserValidators = [
    check(['firstName', 'firstLastName', 'secondLastName'])
        .notEmpty().withMessage(commonStrings.error.userErrors.name.empty)
        .isLength({ max: 255 }).withMessage(commonStrings.error.userErrors.name.max),
    check('email')
        .notEmpty().withMessage(commonStrings.error.userErrors.email.empty)
        .isEmail().withMessage(commonStrings.error.userErrors.email.invalid)
        .custom(async (value, { req }) => {
            const user = await User.findOne({ email: value });
            if (user) {
                throw new NotFoundError(commonStrings.error.userErrors.email.invalid);
            }

            const domain = value.split('@')[1];
            if (domain !== config.domains.email) {
                throw new BadRequestError(commonStrings.error.userErrors.email.invalid);
            }

            return true;
        }),
    check('password')
        .notEmpty()
        .withMessage(commonStrings.error.password.empty)
        .isLength({ min: 12 })
        .withMessage(commonStrings.error.password.minLenght)
        .matches(/[a-z]/)
        .withMessage(commonStrings.error.password.lowercaseLetter)
        .matches(/[A-Z]/)
        .withMessage(commonStrings.error.password.uppercaseLetter)
        .matches(/[0-9]/)
        .withMessage(commonStrings.error.password.number)
        .matches(/[!@#$%^&*(),.?":{}|<>]/)
        .withMessage(commonStrings.error.password.specialCharacter)
];

const updateUserValidators = [
    check(['firstName', 'lastName'])
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage(commonStrings.error.userErrors.name.max),
    check('email')
        .optional({ checkFalsy: true })
        .isEmail().withMessage(commonStrings.error.userErrors.email.invalid)
        .custom(async (value, { req }) => {
            const user = await User.findOne({ email: value });
            if (user && user._id != req.params.id) {
                throw new NotFoundError(commonStrings.error.userErrors.invalid);
            }

            const domain = value.split('@')[1];
            if (domain !== config.domains.email) {
                throw new BadRequestError(commonStrings.error.userErrors.invalid);
            }
            return true;
        }),
    check('password')
        .optional({ checkFalsy: true })
        .isLength({ min: 12 })
        .withMessage(commonStrings.error.password.minLenght)
        .matches(/[a-z]/)
        .withMessage(commonStrings.error.password.lowercaseLetter)
        .matches(/[A-Z]/)
        .withMessage(commonStrings.error.password.uppercaseLetter)
        .matches(/[0-9]/)
        .withMessage(commonStrings.error.password.number)
        .matches(/[!@#$%^&*(),.?":{}|<>]/)
        .withMessage(commonStrings.error.password.specialCharacter),
    check('')
        .custom(async (value, {req}) => {
            const user = await User.findById(req.params.id);
            if (user.privilege == privileges.admin.privilege) {
                throw new BadRequestError(commonStrings.error.userUpdateErrors.user.cantUpdate);
            }

            return true;
        }),
    check()
        .custom((value, { req }) => {
            const { firstName, firstLastName, secondLastName, email, password} = req.body;
            if(!firstName && !firstLastName && !secondLastName && !email && !password){
                throw new BadRequestError(commonStrings.error.userUpdateErrors.restrictions.minOneToUpdate)
            }
            return true;
        })
];

const deleteUserValidators = [
    check('')
        .custom(async (value, { req }) => {
            const user = await User.findById(req.params.id);
            if (!user) {
                throw new NotFoundError(commonStrings.error.userErrors.user.cant_update);
            }
            return true;
        }),
    check('')
        .custom(async (value, {req}) => {
            const user = await User.findById(req.params.id);
            if (user.privilege == privileges.admin.privilege) {
                throw new BadRequestError(commonStrings.error.userErrors.user.cant_delete);
            }

            return true;
        }),
];

async function getUsers(req, res, next) {
    try {
        const users = await User.find({ privilege: privileges.employee.privilege});
        const mappedUsers = users.map(userInfo => ({
            id: userInfo.id,
            firstName: userInfo.firstName,
            firstLastName: userInfo.firstLastName,
            secondLastName: userInfo.secondLastName,
            email: userInfo.email,
        }));
        console.log(users);

        console.log("Usuarios recuperados con éxito");
        res.status(200).json({ success: true, message: "Usuarios recuperados con éxito", content: mappedUsers});
    } catch (err) {
        return next(err);
    }
}

async function createUser(req, res, next) {
    const { firstName, firstLastName, secondLastName, email, password } = req.body;
    const userToAdd = new User ({
        firstName, firstLastName, secondLastName, email, password, privilege: "employee"
    });

    try{    
        await userToAdd.save();
        
        console.log("Usuario agregado con éxito");
        res.status(200).json({ success: true, message: "Usuario agregado con éxito", content: userToAdd._id});
    } catch(err){
        console.log(err);
        return next(err);
    }   
}

async function updateUser(req, res, next) {
    const { firstName, firstLastName, secondLastName, email, password } = req.body;
    const { id } = req.params;
    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (firstLastName) { updateFields.firstLastName = firstLastName; }
    if (secondLastName) { updateFields.secondLastName = secondLastName; }
    if (email) { updateFields.email = email; }
    if (password) { updateFields.password = password; }

    try {
        const userToUpdate = await User.findById(id);
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        if (userToUpdate.privilege != privileges.employee.privilege) {
            throw new BadRequestError("No puede modificarse la información de este usuario");
        }

        Object.assign(userToUpdate, updateFields);
        await userToUpdate.save();

        console.log("Usuario editado con éxito");        
        res.status(200).json({ success: true, message: "Usuario editado con éxito", content: userToUpdate._id});
    } catch(err) {
        return next(err);
    }
}

async function deleteUser(req, res, next) {
    const { id } = req.params;

    try {
        const userToDelete = await User.findById(id);
        if (!userToDelete) {
            throw new NotFoundError("User not found");
        }

        if (userToDelete.privilege != privileges.employee.privilege) {
            throw new BadRequestError("No puede eliminarse este usuario");
        }

        await User.deleteOne({ _id: id });

        console.log("Usuario eliminado con éxito");
        res.status(200).json({ success: true, message: "Usuario eliminado con éxito"});
    } catch(err) {
        return next(err);
    }    
}

module.exports = {
    createUserValidators,
    updateUserValidators,
    deleteUserValidators,
    getUsers,
    createUser,
    updateUser,
    deleteUser
}
