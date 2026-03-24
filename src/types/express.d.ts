declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      username: string | null;
      role: "admin" | "user";
      profilePicture?: string | null;
      isEmailVerified?: boolean;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
