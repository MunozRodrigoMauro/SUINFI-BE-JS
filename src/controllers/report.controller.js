//src/controllers/report.controller.js
import Report from "../models/Report.js";
import { sendNotificationEmail } from "../services/mailer.js";

function asRecord(v) {
  if (!v || typeof v !== "object") return null;
  return v;
}

function getErrorCode(e) {
  const r = asRecord(e);
  const code = r && r.code;
  return typeof code === "number" ? code : null;
}

function safeStr(v) {
  return typeof v === "string" ? v : "";
}

function buildReportEmail({ report, reporterUser, ip, ua }) {
  const to = process.env.REPORTS_EMAIL || "info@cuyit.com";

  const bookingId = safeStr(report?.bookingId?.toString?.() || report?.bookingId);
  const reporterId = safeStr(report?.reporterId?.toString?.() || report?.reporterId);
  const targetUserId = safeStr(report?.targetUserId?.toString?.() || report?.targetUserId);
  const reason = safeStr(report?.reason);
  const details = safeStr(report?.details);

  const reporterName = safeStr(reporterUser?.name);
  const reporterEmail = safeStr(reporterUser?.email);

  const createdAt = safeStr(report?.createdAt?.toISOString?.() || report?.createdAt);

  const subject = `Nueva denuncia: ${reason || "sin-motivo"} (booking ${bookingId || "—"})`;

  const text = [
    "Nueva denuncia recibida",
    "",
    `Report ID: ${safeStr(report?._id?.toString?.() || report?._id)}`,
    `Booking ID: ${bookingId}`,
    `Motivo: ${reason}`,
    `Detalles: ${details || "—"}`,
    "",
    "Participantes",
    `Reporter: ${reporterName || "—"} (${reporterEmail || "—"}) [${reporterId || "—"}]`,
    `TargetUserId: ${targetUserId || "—"}`,
    "",
    "Meta",
    `CreatedAt: ${createdAt || "—"}`,
    `IP: ${safeStr(ip) || "—"}`,
    `UA: ${safeStr(ua) || "—"}`,
  ].join("\n");

  const html = `
  <div style="margin:0;padding:0;background:#f7f8fb">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fb;padding:24px 0">
      <tr><td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 6px 24px rgba(16,24,40,.06);border:1px solid #e5e7eb">
          <tr>
            <td style="padding:22px 26px 0 26px;">
              <div style="font-weight:800;font-size:20px;font-family:system-ui,-apple-system,Segoe UI,Roboto;color:#111827;">CuyIT – Nueva denuncia</div>
              <div style="margin-top:6px;color:#64748b;font-size:12px;font-family:system-ui,-apple-system,Segoe UI,Roboto;">Se creó una denuncia desde Mobile/Web.</div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 26px 0 26px;">
              <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#fff1f2;border:1px solid #ffe4e6;color:#be123c;font-weight:800;font-size:12px;font-family:system-ui,-apple-system,Segoe UI,Roboto;">
                Motivo: ${reason || "—"}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 26px 0 26px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 10px">
                <tr>
                  <td style="color:#0f172a;font-weight:700;font-size:13px;font-family:system-ui,-apple-system,Segoe UI,Roboto;width:140px;">Report ID</td>
                  <td style="color:#334155;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${safeStr(
                    report?._id?.toString?.() || report?._id || "—",
                  )}</td>
                </tr>
                <tr>
                  <td style="color:#0f172a;font-weight:700;font-size:13px;font-family:system-ui,-apple-system,Segoe UI,Roboto;">Booking ID</td>
                  <td style="color:#334155;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${bookingId || "—"}</td>
                </tr>
                <tr>
                  <td style="color:#0f172a;font-weight:700;font-size:13px;font-family:system-ui,-apple-system,Segoe UI,Roboto;">Reporter</td>
                  <td style="color:#334155;font-size:13px;font-family:system-ui,-apple-system,Segoe UI,Roboto;">
                    ${reporterName || "—"} ${reporterEmail ? `(${reporterEmail})` : ""}
                    <div style="margin-top:4px;color:#64748b;font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${reporterId || "—"}</div>
                  </td>
                </tr>
                <tr>
                  <td style="color:#0f172a;font-weight:700;font-size:13px;font-family:system-ui,-apple-system,Segoe UI,Roboto;">Target User</td>
                  <td style="color:#334155;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${targetUserId || "—"}</td>
                </tr>
                <tr>
                  <td style="color:#0f172a;font-weight:700;font-size:13px;font-family:system-ui,-apple-system,Segoe UI,Roboto;">Creado</td>
                  <td style="color:#334155;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${createdAt || "—"}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:6px 26px 0 26px;">
              <div style="color:#0f172a;font-weight:800;font-size:13px;font-family:system-ui,-apple-system,Segoe UI,Roboto;">Detalles</div>
              <div style="margin-top:8px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;color:#0f172a;font-size:13px;line-height:1.6;font-family:system-ui,-apple-system,Segoe UI,Roboto;white-space:pre-wrap;">
                ${details ? details.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "—"}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 26px 22px 26px;">
              <div style="color:#64748b;font-size:12px;font-family:system-ui,-apple-system,Segoe UI,Roboto;">
                IP: ${safeStr(ip) || "—"} · UA: ${safeStr(ua) || "—"}
              </div>
            </td>
          </tr>
        </table>

        <div style="color:#94a3b8;font-size:11px;margin-top:12px;font-family:system-ui,-apple-system,Segoe UI,Roboto">© ${new Date().getFullYear()} CuyIT</div>
      </td></tr>
    </table>
  </div>`;

  return { to, subject, text, html };
}

export const createReport = async (req, res) => {
  try {
    const { bookingId, targetUserId, reason, details } = req.body || {};
    const reporterId = req.user._id;

    if (!reason) return res.status(400).json({ message: "Falta reason" });

    const report = await Report.create({
      bookingId,
      reporterId,
      targetUserId,
      reason,
      details: (details || "").trim(),
    });

    res.status(201).json(report);

    try {
      const ip = safeStr(req.headers["x-forwarded-for"]) || safeStr(req.ip);
      const ua = safeStr(req.headers["user-agent"]);
      const mail = buildReportEmail({
        report,
        reporterUser: req.user,
        ip,
        ua,
      });

      sendNotificationEmail({
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }).catch(() => {});
    } catch {
      // noop
    }
  } catch (e) {
    const code = getErrorCode(e);
    if (code === 11000) {
      return res.status(409).json({ message: "Ya denunciaste esta reserva" });
    }
    res.status(500).json({ message: "No se pudo crear la denuncia" });
  }
};

export const getMyReports = async (req, res) => {
  const list = await Report.find({ reporterId: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json(list);
};

// Admin endpoints
export const listReports = async (req, res) => {
  void req;
  const list = await Report.find().sort({ createdAt: -1 }).lean();
  res.json(list);
};

export const updateReportStatus = async (req, res) => {
  const { id } = req.params;
  const { status, resolutionNote } = req.body || {};
  if (!status) return res.status(400).json({ message: "Falta status" });

  const report = await Report.findByIdAndUpdate(
    id,
    { $set: { status, resolutionNote } },
    { new: true }
  );
  if (!report) return res.status(404).json({ message: "Report no encontrado" });
  res.json(report);
};