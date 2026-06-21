import { ZodError } from "zod";

/**
 * validate(schema)
 *
 * Validates req.body against a Zod schema.
 * Returns 400 with structured field errors on failure.
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), authController.register)
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors,
      });
    }

    req.body = result.data;
    next();
  };
}
