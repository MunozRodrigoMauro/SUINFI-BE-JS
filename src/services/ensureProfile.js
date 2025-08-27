// Crea (si no existe) el perfil correspondiente al rol
import AdminModel from "../models/Admin.js";
import ClientModel from "../models/Client.js";
import ProfessionalModel from "../models/Professional.js";

export const ensureProfileByRole = async (user) => {
  if (!user?._id || !user.role) return;

  switch (user.role) {
    case "admin":
      await AdminModel.findOneAndUpdate(
        { user: user._id },
        { $setOnInsert: { user: user._id, active: true } },
        { upsert: true, new: true }
      );
      break;

    case "user": // (Client en el FE)
      await ClientModel.findOneAndUpdate(
        { user: user._id },
        { $setOnInsert: { user: user._id } },
        { upsert: true, new: true }
      );
      break;

    case "professional":
      // Esqueleto mínimo; no forzamos validaciones para permitir onboarding luego
      await ProfessionalModel.findOneAndUpdate(
        { user: user._id },
        { $setOnInsert: { user: user._id, onboarding: { step: 1 } } },
        { upsert: true, new: true, runValidators: false }
      );
      break;
  }
};
