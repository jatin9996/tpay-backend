import express from "express";
import { ethers } from "ethers";

const router = express.Router();

// Test endpoint to debug signature issues
router.get("/test-signature", (req, res) => {
    try {
        const testMessage = "Test message for signature verification";
        const testPrivateKey = "0x1234567890123456789012345678901234567890123456789012345678901234";
        const wallet = new ethers.Wallet(testPrivateKey);
        const testSignature = wallet.signMessage(testMessage);
        
        console.log("Test signature generation:");
        console.log("Message:", testMessage);
        console.log("Private key:", testPrivateKey);
        console.log("Generated signature:", testSignature);
        console.log("Signature length:", testSignature.length);
        
        // Try to verify
        const recovered = ethers.verifyMessage(testMessage, testSignature);
        console.log("Recovered address:", recovered);
        console.log("Expected address:", wallet.address);
        
        res.json({
            success: true,
            testMessage,
            testSignature,
            signatureLength: testSignature.length,
            recoveredAddress: recovered,
            expectedAddress: wallet.address,
            ethersVersion: ethers.version
        });
    } catch (err) {
        console.error("Test signature error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { address, signature, message } = req.body;
        
        // Debug logging to see what we're receiving
        console.log("Received login request:");
        console.log("Address:", address);
        console.log("Message:", message);
        console.log("Signature:", signature);
        console.log("Signature type:", typeof signature);
        console.log("Signature length:", signature ? signature.length : "undefined");
        console.log("Ethers version:", ethers.version);

        // Validate that signature is a proper hex string
        if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid signature format. Signature must be a hex string starting with 0x" 
            });
        }

        // Validate signature length (should be 132 characters for 0x + 65 bytes)
        if (signature.length !== 132) {
            console.log(`Warning: Signature length is ${signature.length}, expected 132`);
            // Don't fail immediately, try to verify anyway
        }

        try {
            // Try to verify the signature
            const recovered = ethers.verifyMessage(message, signature);
            console.log("Recovered address:", recovered);
            
            if (recovered.toLowerCase() === address.toLowerCase()) {
                return res.json({ success: true, address, token: "demo_jwt_token" });
            } else {
                console.log("Address mismatch. Expected:", address.toLowerCase(), "Got:", recovered.toLowerCase());
                return res.status(401).json({ success: false, error: "Invalid signature" });
            }
        } catch (verifyError) {
            console.error("Signature verification error:", verifyError);
            
            // Try to parse the signature manually to see what's wrong
            try {
                // Check if it's a valid hex string
                if (!/^0x[a-fA-F0-9]+$/.test(signature)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: "Signature is not a valid hexadecimal string" 
                    });
                }
                
                // Try to convert to bytes
                const signatureBytes = ethers.getBytes(signature);
                console.log("Signature as bytes length:", signatureBytes.length);
                
                return res.status(400).json({ 
                    success: false, 
                    error: `Signature verification failed: ${verifyError.message}. Signature bytes length: ${signatureBytes.length}` 
                });
            } catch (parseError) {
                console.error("Signature parsing error:", parseError);
                return res.status(400).json({ 
                    success: false, 
                    error: `Signature parsing failed: ${parseError.message}` 
                });
            }
        }
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
