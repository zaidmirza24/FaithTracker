import jwt from "jsonwebtoken";

export const generateToken = (user, role) => {
  return jwt.sign(
    { userId: user._id, role, city: user.city || null },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};
