import Mailgen from "mailgen";
import { Resend } from "resend";
import logger from "../logger/winston.logger";

const resend = new Resend(process.env.RESEND_API_KEY);

const mailGenerator = new Mailgen({
  theme: "default",
  product: {
    name: "FreeAPI",
    link: "https://freeapi.app",
  },
});

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not defined in environment variables");
}

if (!process.env.RESEND_FROM_EMAIL) {
  throw new Error("RESEND_FROM_EMAIL is not defined in environment variables");
}

const sendEmail = async (options: {
  email: string;
  subject: string;
  mailgenContent: Mailgen.Content;
}) => {
  const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent);
  const emailHtml = mailGenerator.generate(options.mailgenContent);

  try {
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: options.email,
      subject: options.subject,
      html: emailHtml,
      text: emailTextual,
    });

   
    if (response.error) {
      logger.error("Failed to send email", {
        to: options.email,
        subject: options.subject,
        error: response.error,
      });
      throw new Error(`Email delivery failed: ${response.error.message}`);
    }

  
    logger.info("Email sent successfully", {
      to: options.email,
      subject: options.subject,
      messageId: response.data?.id,
    });

    return { success: true, data: response.data };
  } catch (error) {
    logger.error("Failed to send email (exception)", {
      to: options.email,
      subject: options.subject,
      error: error instanceof Error ? error.message : error,
    });

    throw new Error(
      `Email delivery failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

const emailVerificationMailgenContent = (
  username: string,
  verificationUrl: string
) => {
  return {
    body: {
      name: username,
      intro: "Welcome to our app! We're very excited to have you on board.",
      action: {
        instructions:
          "To verify your email please click on the following button:",
        button: {
          color: "#22BC66",
          text: "Verify your email",
          link: verificationUrl,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email, we'd love to help.",
    },
  };
};

const forgotPasswordMailgenContent = (
  username: string,
  passwordResetUrl: string
) => {
  return {
    body: {
      name: username,
      intro: "We got a request to reset the password of our account",
      action: {
        instructions:
          "To reset your password click on the following button or link:",
        button: {
          color: "#22BC66", // Optional action button color
          text: "Reset password",
          link: passwordResetUrl,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email, we'd love to help.",
    },
  };
};

export {
  sendEmail,
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
};
