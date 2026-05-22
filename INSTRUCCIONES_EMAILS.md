// Archivo: supabase/functions/send-email/index.ts
// Este archivo debe ser creado en tu proyecto Supabase
// Ejemplo usando SendGrid como proveedor de emails

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts"

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || ""
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") || "noreply@syncbook.com"
const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.sendgrid.net"
const SMTP_USER = Deno.env.get("SMTP_USER") || "apikey"
const SMTP_PASS = Deno.env.get("SMTP_PASS") || SENDGRID_API_KEY

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const { to, subject, cliente, fecha, hora, servicio, precio, negocio, direccion, ciudad, telefono, gmaps } = await req.json()

    if (!to) {
      return new Response(JSON.stringify({ error: "Email recipient required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Construir HTML del email
    const htmlContent = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#6941C6">Tu cita está confirmada!</h2>
        <p>Hola <strong>${cliente}</strong>,</p>
        <p>Tu reserva en <strong>${negocio}</strong> ha sido confirmada.</p>
        
        <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:20px 0">
          <h3 style="margin-top:0">Detalles de tu cita</h3>
          <p><strong>📅 Fecha:</strong> ${fecha}</p>
          <p><strong>🕐 Hora:</strong> ${hora}</p>
          <p><strong>✂️ Servicio:</strong> ${servicio}</p>
          <p><strong>💰 Precio:</strong> $${precio}</p>
        </div>
        
        <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:20px 0">
          <h3 style="margin-top:0">📍 Ubicación</h3>
          <p><strong>${negocio}</strong></p>
          <p>${direccion}, ${ciudad}</p>
          <p><strong>📞 Teléfono:</strong> ${telefono}</p>
          ${gmaps ? `<p><a href="${gmaps}" target="_blank" style="color:#6941C6">Ver en Google Maps →</a></p>` : ""}
        </div>
        
        <p style="color:#666;font-size:0.9em">Si necesitas cancelar o reprogramar tu cita, contáctanos lo antes posible.</p>
        <p style="color:#666;font-size:0.9em">— SyncBook · Tu plataforma de reservas</p>
      </div>
    `

    // Opción 1: Usar SendGrid API
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
            subject: subject
          }
        ],
        from: { email: SENDER_EMAIL },
        content: [
          {
            type: "text/html",
            value: htmlContent
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("SendGrid error:", error)
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
