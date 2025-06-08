// Email service integration
// This example uses a generic email API - replace with your preferred service
// (Mailgun, SendGrid, Resend, etc.)

export async function sendMagicLink(env, email, magicLink, token) {
  // For development, just log the magic link
  if (env.ENVIRONMENT === 'development') {
    console.log(`Magic link for ${email}: ${magicLink}`);
    return { success: true };
  }

  // Example using a generic email API
  // Replace this with your actual email service
  const emailData = {
    to: email,
    from: 'noreply@stillmind.app',
    subject: 'Your StillMind Magic Link',
    html: generateEmailHTML(magicLink),
    text: generateEmailText(magicLink)
  };

  try {
    const response = await fetch(env.EMAIL_API_URL || 'https://api.emailservice.com/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.EMAIL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      throw new Error(`Email API error: ${response.status}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Email sending error:', error);
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