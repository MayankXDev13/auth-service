declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      username: string | null;
      role: "admin" | "user";
      profilePicture: true;
      isEmailVerified: true;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
