import express from "express";
import cors from "cors";
import config from "./config/env.js";
import authRoutes from "./routes/auth.js";
import swapRoutes from "./routes/swap.js";
import liquidityRoutes from "./routes/liquidity.js";
import poolRoutes from "./routes/pools.js";
import tokenRoutes from "./routes/tokens.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/dex", swapRoutes);
app.use("/liquidity", liquidityRoutes);
app.use("/data", poolRoutes);
app.use("/tokens", tokenRoutes);

app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
});

export default app;
