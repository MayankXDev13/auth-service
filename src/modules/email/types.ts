export type EmailJob = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attempts?: number;
};

export type EmailJobResult = { id: string };
