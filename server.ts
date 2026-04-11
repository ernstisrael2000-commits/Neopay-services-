import express from "express";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for registration notification
  app.post("/api/notify-registration", async (req, res) => {
    const { name, email, phone, message, date } = req.body;

    try {
      // Check if SMTP credentials are provided
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("SMTP credentials missing. Skipping email notification.");
        return res.status(200).json({ success: true, warning: "SMTP credentials missing" });
      }

      // 1. Send Email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: `"Neopay System" <${process.env.SMTP_USER}>`,
        to: "neopayservices509@gmail.com",
        subject: `Nouvelle demande d'inscription affilié : ${name}`,
        text: `
          Nouvelle demande d'inscription reçue !
          
          Nom: ${name}
          Email: ${email}
          Téléphone: ${phone || "Non fourni"}
          Message: ${message || "Aucun message"}
          Date: ${date}
          
          Veuillez vous connecter au tableau de bord administrateur pour approuver ou rejeter cette demande.
        `,
      };

      await transporter.sendMail(mailOptions);

      // 2. WhatsApp Notification (Simulated)
      // Note: Real WhatsApp automation requires a paid API like Twilio or a gateway.
      // We log the intent here.
      console.log(`[WhatsApp Notification] To Admin: Nouvelle inscription de ${name} (${phone})`);

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
