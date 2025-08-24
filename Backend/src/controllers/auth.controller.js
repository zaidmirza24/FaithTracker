import bcrypt from "bcrypt";
import Admin from "../models/admin.js";
import Teacher from "../models/Teachers.js";
import { generateToken } from "../utils/jwt.js";

export const register = async (req, res) => {
  const { name, email, password, role, city } = req.body;

  try {
    // const passwordHash = await bcrypt.hash(password, 10);

    let user;
    if (role === "admin") {
      user = await Admin.create({ name, email, password });
    } else if (role === "teacher") {
      user = await Teacher.create({ name, email, password, city });
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }

    const token = generateToken(user, role);
    res.status(201).json({
      message: `${role} registered successfully ✅`,
      token,
      role,
      user: { id: user._id, name: user.name, city: user.city || null }
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed ❌", error: err.message });
  }
};



export const login = async (req, res) => {
  const { email, password, role } = req.body;
  try {
    let user;
    if (role === "admin") user = await Admin.findOne({ email });
    else if (role === "teacher") user = await Teacher.findOne({ email });
    else return res.status(400).json({ message: "Invalid role" });

    if (!user) return res.status(404).json({ message: "User not found" });

    // const match = await bcrypt.compare(password, user.passwordHash);
    // if (!match) return res.status(401).json({ message: "Invalid credentials" });
    if(password !== user.password){
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user, role);
    return res.json({ token,
       user: { id: user._id, name: user.name, city: user.city || null,role } 
      });
  } catch (err) {
    return res.status(500).json({ message: "Login error", error: err.message });
  }
};
