const { Router } = require("express");
const validate = require("../middlewares/validate");

const UserRouter = Router();

UserRouter.post("/register", validate, (req, res) => {});
