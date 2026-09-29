import nodemailer from 'nodemailer';

export async function sendOtpEmail(toEmail: string, otp: string, userName?: string) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user || 'no-reply@digiqc.com';

    if (!user || !pass) {
        console.warn('SMTP credentials not configured. OTP:', otp);
        return { messageId: 'mock-id' };
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f8fafc; margin: 0; padding: 24px; }
      .container { max-width: 480px; margin: 0 auto; background: #111827; border-radius: 16px; border: 1px solid #1f2937; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
      .logo-box { text-align: center; margin-bottom: 24px; }
      .logo-badge { display: inline-block; background: #0d9488; color: #ffffff; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; font-weight: bold; font-size: 20px; text-align: center; }
      .title { font-size: 22px; font-weight: 700; color: #ffffff; text-align: center; margin: 0 0 8px 0; }
      .subtitle { font-size: 14px; color: #9ca3af; text-align: center; margin: 0 0 24px 0; }
      .otp-card { background: #0b0f19; border: 1px dashed #0d9488; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
      .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #2dd4bf; font-family: monospace; margin: 0; }
      .expiry-text { font-size: 12px; color: #9ca3af; margin-top: 12px; }
      .footer { font-size: 12px; color: #6b7280; text-align: center; margin-top: 24px; border-top: 1px solid #1f2937; padding-top: 16px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo-box">
        <div class="logo-badge">✓</div>
      </div>
      <h1 class="title">Verification Code</h1>
      <p class="subtitle">Hello ${userName || 'there'}, use the following one-time password (OTP) to sign in to DigiQC.</p>

      <div class="otp-card">
        <div class="otp-code">${otp}</div>
        <div class="expiry-text">This code is valid for 10 minutes. Do not share it with anyone.</div>
      </div>

      <p style="font-size: 13px; color: #9ca3af; line-height: 1.5;">If you did not request this verification code, please ignore this email or contact support if you suspect unauthorized access.</p>

      <div class="footer">
        &copy; ${new Date().getFullYear()} DigiQC — Quality Control Platform. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;

    return await transporter.sendMail({
        from: `"DigiQC" <${from}>`,
        to: toEmail,
        subject: `Your DigiQC Verification Code: ${otp}`,
        text: `Your DigiQC verification code is: ${otp}. It is valid for 10 minutes.`,
        html,
    });
}
