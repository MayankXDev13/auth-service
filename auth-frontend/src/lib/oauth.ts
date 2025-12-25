const API_URL = "http://localhost:4000/api/v1";

export const loginWithGoogle = () => {
  window.location.href = `${API_URL}/users/google`;
};

export const loginWithGithub = () => {
  window.location.href = `${API_URL}/users/github`;
};