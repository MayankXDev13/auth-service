import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Auth service running on port ${PORT}`);
});
