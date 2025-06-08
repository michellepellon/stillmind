import nodemailer from 'nodemailer';

let transporter;

// Initialize email transporter
export function initEmailService() {
  const config = {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025'),
    secure: process.env.SMTP_SECURE === 'true',
    ignoreTLS: process.env.NODE_ENV === 'development'
  };
  
  // Add auth if credentials are provided
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    config.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    };
  }
  
  transporter = nodemailer.createTransport(config);
  
  // Verify connection
  transporter.verify((error, success) => {
    if (error) {
      console.error('Email service error:', error);
    } else {
      console.log('Email service ready');
    }
  });
}

// Initialize on module load
initEmailService();

export async function sendMagicLink(email, magicLink, token) {
  if (!transporter) {
    throw new Error('Email service not initialized');
  }
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@stillmind.local',
    to: email,
    subject: 'Your StillMind Magic Link',
    html: generateEmailHTML(magicLink),
    text: generateEmailText(magicLink)
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

function generateEmailHTML(magicLink) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>StillMind Magic Link</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          line-height: 1.6;
          color: #2c3e50;
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .container {
          background: #f8f9fa;
          padding: 40px;
          border-radius: 8px;
          text-align: center;
        }
        .button {
          display: inline-block;
          background: #2c3e50;
          color: white;
          text-decoration: none;
          padding: 16px 32px;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 500;
        }
        .footer {
          margin-top: 40px;
          font-size: 14px;
          color: #6c757d;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to StillMind</h1>
        <p>Click the button below to sign in to your meditation journal:</p>
        
        <a href="${magicLink}" class="button">Sign In to StillMind</a>
        
        <p><small>This link will expire in 15 minutes for security.</small></p>
        
        <div class="footer">
          <p>If you didn't request this email, you can safely ignore it.</p>
          <p>This link can only be used once.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateEmailText(magicLink) {
  return `
Welcome to StillMind

Click this link to sign in to your meditation journal:
${magicLink}

This link will expire in 15 minutes for security.

If you didn't request this email, you can safely ignore it.
This link can only be used once.
  `;
}