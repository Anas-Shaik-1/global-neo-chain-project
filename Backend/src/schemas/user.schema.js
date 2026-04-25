// schemas/user.schema.js
const { z, check } = require("zod");

const createUserSchema = z.object({
  name: z.string().refine(check=> ),
  email: z.string().email("Invalid Email"),
  password: z.string().min(8, "Password must contain more that 8 characters"),
});

module.exports = { createUserSchema };
