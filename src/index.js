import express from "express";
import cors from "cors";
import config from "./config/env.js";
import connectDB from "./config/database.js";
import authRoutes from "./routes/auth.js";
import swapRoutes from "./routes/swap.js";
import liquidityRoutes from "./routes/liquidity.js";
import poolRoutes from "./routes/pools.js";
import tokenRoutes from "./routes/tokens.js";
import searchRoutes from "./routes/search.js";
import wethApprovalRoutes from "./routes/wethApproval.js";

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

app.use("/auth", authRoutes);
app.use("/dex", swapRoutes);
app.use("/liquidity", liquidityRoutes);
app.use("/data", poolRoutes);
app.use("/tokens", tokenRoutes);
app.use("/search", searchRoutes);
app.use("/api/weth", wethApprovalRoutes);

app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
});

export default app;
