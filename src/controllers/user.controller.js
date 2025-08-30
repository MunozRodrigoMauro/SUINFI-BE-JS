import UserModel from "../models/User.js";
import bcrypt from "bcrypt";
import ProfessionalModel from "../models/Professional.js";
import crypto from "crypto";
import { sendVerificationEmail } from "../services/mailer.js";
import { ensureProfileByRole } from "../services/ensureProfile.js";
import ClientModel from "../models/Client.js";
import AdminModel from "../models/Admin.js";
import path from "path";

// Crear usuario
export const createUser = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    // tolera 'client' desde el FE, lo normaliza a 'user'
    if (role === "client") role = "user";

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const userExist = await UserModel.findOne({ email });
    if (userExist) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Token de verificación en minúsculas (consistencia)
    const verifyToken = crypto.randomBytes(32).toString("hex").toLowerCase();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48h

    const user = new UserModel({
      name,
      email,
      password: hashedPassword,
      role,
      verified: false,
      emailVerification: { token: verifyToken, expiresAt: expires },
    });

    const savedUser = await user.save();
    await ensureProfileByRole(savedUser);

    try {
      await sendVerificationEmail(savedUser.email, verifyToken);
    } catch (e) {
      console.error("❌ Error enviando correo de verificación:", e);
    }

    return res.status(201).json({
      message: "User created. Please verify your email.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// Obtener todos
export const getUsers = async (_req, res) => {
  try {
    const users = await UserModel.find();
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

/** GET /api/users/me */
export const getMe = async (req, res) => {
  try {
    const me = await UserModel.findById(req.user.id).lean();
    if (!me) return res.status(404).json({ message: "User not found" });
    res.json(me);
  } catch (e) {
    console.error("getMe error", e);
    res.status(500).json({ message: "Server error" });
  }
};

/** PATCH /api/users/me
 *  Actualiza datos básicos y address; si el user es professional, sincroniza su Professional.
 */
export const updateMe = async (req, res) => {
  try {
    const userId = req.user.id;

    // Campos permitidos
    const allowed = [
      "name",
      "password", // si tuvieras hashing, aplicalo acá
      "address.country",
      "address.state",
      "address.city",
      "address.street",
      "address.number",
      "address.unit",
      "address.postalCode",
      "address.label",
      "address.location.lat",
      "address.location.lng",
    ];

    const payload = {};
    for (const key of allowed) {
      const parts = key.split(".");
      let src = req.body;
      let tgt = payload;
      for (let i = 0; i < parts.length; i++) {
        const k = parts[i];
        const isLeaf = i === parts.length - 1;
        if (!(k in src)) break;
        if (isLeaf) {
          tgt[k] = src[k];
        } else {
          src = src[k];
          if (src == null) break;
          if (!(k in tgt)) tgt[k] = {};
          tgt = tgt[k];
        }
      }
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $set: payload },
      { new: true }
    ).lean();

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    // Si es profesional, reflejar address + GeoJSON
    if (updatedUser.role === "professional") {
      const a = updatedUser.address || {};
      const hasCoords =
        a?.location &&
        typeof a.location.lat === "number" &&
        typeof a.location.lng === "number";

      const proPatch = {
        "address.country": a.country || "",
        "address.state": a.state || "",
        "address.city": a.city || "",
        "address.street": a.street || "",
        "address.number": a.number || "",
        "address.unit": a.unit || "",
        "address.postalCode": a.postalCode || "",
        "address.label": a.label || "",
        "address.location": hasCoords
          ? { lat: a.location.lat, lng: a.location.lng }
          : { lat: null, lng: null },
      };

      if (hasCoords) {
        proPatch.location = {
          type: "Point",
          coordinates: [Number(a.location.lng), Number(a.location.lat)], // [lng, lat]
        };
        proPatch.lastLocationAt = new Date();
      }

      const pro = await ProfessionalModel.findOneAndUpdate(
        { user: userId },
        { $set: proPatch },
        { new: true }
      );

      // Emitimos evento en vivo si hay coords
      if (pro && hasCoords) {
        const io = req.app.get("io");
        io?.emit("pro:location:update", {
          userId: String(userId),
          lat: a.location.lat,
          lng: a.location.lng,
          at: new Date().toISOString(),
          isAvailableNow: !!pro.isAvailableNow,
        });
      }
    }

    res.json({ message: "User updated", user: updatedUser });
  } catch (e) {
    console.error("updateMe error", e);
    res.status(500).json({ message: "Server error" });
  }
};

// Perfil profesional (requiere ProfessionalModel)
export const getMyProfile = async (req, res) => {
  try {
    const u = req.user;
    const prof = await ProfessionalModel.findOne({ user: u.id }, "location").lean();

    const hasName = (u.name || "").trim().length >= 2;
    const hasAvatar = (u.avatarUrl || "").trim().length > 0;
    const hasLocation = !!(prof?.location?.coordinates?.length === 2);

    const requiresOnboarding = !(hasName && hasLocation);

    res.json({ user: u, requiresOnboarding });
  } catch (e) {
    console.error("❌ getMyProfile:", e);
    res.status(500).json({ error: "Server error" });
  }
};



export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // limpia perfiles dependientes
    await Promise.all([
      ProfessionalModel.deleteOne({ user: id }),
      ClientModel.deleteOne({ user: id }),
      AdminModel.deleteOne?.({ user: id }) ?? Promise.resolve(),
      // TODO opcional: Conversations.deleteMany({ participants: id })
      // TODO opcional: Messages.deleteMany({ $or:[{from:id},{to:id}] })
      // TODO opcional: Bookings.deleteMany({ $or:[{client:id},{professionalUserId:id}] })
      // TODO opcional: Reviews.deleteMany({ $or:[{user:id},{professionalUser:id}] })
    ]);

    await UserModel.findByIdAndDelete(id);

    return res.json({ message: "User eliminado y perfiles limpiados" });
  } catch (e) {
    console.error("deleteUser error", e);
    return res.status(500).json({ message: "Server error" });
  }
};

/** PATCH /api/users/me/avatar  (multipart: file) */
export const uploadMyAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Archivo requerido (file)" });

    const rel = path.posix.join("/uploads", "avatars", req.file.filename);
    const userId = req.user.id;

    const updated = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { avatarUrl: rel } },
      { new: true, select: "-password" }
    ).lean();

    // si es profesional, sincronizamos
    if (updated?.role === "professional") {
      await ProfessionalModel.findOneAndUpdate(
        { user: userId },
        { $set: { avatarUrl: rel } },
        { new: false }
      );
    }

    return res.json({ message: "Avatar actualizado", url: rel, user: updated });
  } catch (e) {
    console.error("uploadMyAvatar error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteMyAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    // Actualizar usuario para eliminar avatar
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          avatarUrl: null, // o "" dependiendo de tu schema
          updatedAt: new Date()
        } 
      },
      { 
        new: true, 
        select: "-password"
      }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Si es profesional, sincronizar
    if (updatedUser.role === "professional") {
      try {
        await ProfessionalModel.findOneAndUpdate(
          { user: userId },
          { 
            $set: { 
              avatarUrl: null,
              updatedAt: new Date()
            } 
          }
        );
      } catch (proError) {
        console.error("Error al actualizar profesional:", proError);
      }
    }

    return res.json({ 
      message: "Avatar eliminado", 
      user: updatedUser 
    });

  } catch (error) {
    console.error("deleteMyAvatar error:", error);
    return res.status(500).json({ message: "Error del servidor" });
  }
};