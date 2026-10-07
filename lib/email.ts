import nodemailer from 'nodemailer';
import { getLocalIpAddress } from './network';

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
      <p class="subtitle">Hello ${userName || 'there'}, use the following one-time password (OTP) to sign in to Valid8.</p>

      <div class="otp-card">
        <div class="otp-code">${otp}</div>
        <div class="expiry-text">This code is valid for 10 minutes. Do not share it with anyone.</div>
      </div>

      <p style="font-size: 13px; color: #9ca3af; line-height: 1.5;">If you did not request this verification code, please ignore this email or contact support if you suspect unauthorized access.</p>

      <div class="footer">
        &copy; ${new Date().getFullYear()} Valid8 — Quality Control Platform. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;

    return await transporter.sendMail({
        from: `"Valid8" <${from}>`,
        to: toEmail,
        subject: `Your Valid8 Verification Code: ${otp}`,
        text: `Your Valid8 verification code is: ${otp}. It is valid for 10 minutes.`,
        html,
    });
}

export async function sendPasswordSetupEmail(toEmail: string, userName: string, setupLink: string, isUpdate: boolean = false) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user || 'no-reply@digiqc.com';

    if (!user || !pass) {
        console.warn('SMTP credentials not configured. Setup link:', setupLink);
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

    let resolvedLink = setupLink;
    if (resolvedLink.includes('localhost') || resolvedLink.includes('127.0.0.1')) {
        const machineIp = getLocalIpAddress();
        if (machineIp && machineIp !== 'localhost' && machineIp !== '127.0.0.1') {
            resolvedLink = resolvedLink.replace('localhost', machineIp).replace('127.0.0.1', machineIp);
        }
    }

    const createLink = `${resolvedLink}&mode=create`;
    const updateLink = `${resolvedLink}&mode=update`;

    const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f8fafc; margin: 0; padding: 24px; }
      .container { max-width: 520px; margin: 0 auto; background: #111827; border-radius: 16px; border: 1px solid #1f2937; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
      .logo-box { text-align: center; margin-bottom: 24px; }
      .logo-badge { display: inline-block; background: #0d9488; color: #ffffff; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; font-weight: bold; font-size: 20px; text-align: center; }
      .title { font-size: 22px; font-weight: 700; color: #ffffff; text-align: center; margin: 0 0 8px 0; }
      .subtitle { font-size: 14px; color: #9ca3af; text-align: center; margin: 0 0 24px 0; line-height: 1.5; }
      .btn-container { text-align: center; margin: 28px 0; }
      .btn-primary { display: inline-block; background: #0d9488; color: #ffffff !important; padding: 12px 24px; border-radius: 9999px; font-size: 14px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3); margin: 6px; }
      .btn-secondary { display: inline-block; background: #1f2937; color: #e5e7eb !important; border: 1px solid #374151; padding: 12px 24px; border-radius: 9999px; font-size: 14px; font-weight: 600; text-decoration: none; margin: 6px; }
      .note-card { background: #0b0f19; border: 1px solid #1f2937; border-radius: 12px; padding: 16px; margin: 24px 0; font-size: 12px; color: #9ca3af; line-height: 1.5; }
      .link-text { word-break: break-all; color: #2dd4bf; text-decoration: underline; }
      .footer { font-size: 12px; color: #6b7280; text-align: center; margin-top: 24px; border-top: 1px solid #1f2937; padding-top: 16px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo-box">
        <div class="logo-badge">✓</div>
      </div>
      <h1 class="title">${isUpdate ? 'Update Your Valid8 Password' : 'Set Up Your Valid8 Password'}</h1>
      <p class="subtitle">Hello <strong>${userName || 'User'}</strong>, ${isUpdate ? 'your user account in Valid8 has been updated. Please choose an option below to set or update your account password.' : 'you have been invited to Valid8. Click below to create your password and access your account.'}</p>

      <div class="btn-container">
        <a href="${createLink}" class="btn-primary">Create Password</a>
        <a href="${updateLink}" class="btn-secondary">Update Password</a>
      </div>

      <div class="note-card">
        <strong style="color: #ffffff;">Direct Link:</strong><br>
        If the buttons above do not open, copy and paste this link into your browser:<br>
        <a href="${resolvedLink}" class="link-text">${resolvedLink}</a>
      </div>

      <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; text-align: center;">This setup link is secure and valid for 24 hours.</p>

      <div class="footer">
        &copy; ${new Date().getFullYear()} Valid8 — Quality Control Platform. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;

    return await transporter.sendMail({
        from: `"Valid8" <${from}>`,
        to: toEmail,
        subject: isUpdate ? 'Valid8: Update your account password' : 'Valid8: Set up your account password',
        text: `Hello ${userName || 'User'},\n\nPlease use the following link to create or update your password in Valid8:\n${setupLink}\n\nThis link is valid for 24 hours.`,
        html,
    });
}
