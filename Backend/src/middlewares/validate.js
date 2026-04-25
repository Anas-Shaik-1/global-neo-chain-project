// middleware/validate.js
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  req.validated = result.data;
  next();
};

module.exports = validate;
