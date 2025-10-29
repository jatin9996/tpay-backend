/**
 * Authentication Router - Handles wallet-based authentication using Ethereum signatures
 * Provides endpoints for signature verification and user login
 */

import express from "express";
import { ethers } from "ethers";

const router = express.Router();

/**
 * TEST SIGNATURE ENDPOINT
 * Debug endpoint for testing signature generation and verification
 * Useful for troubleshooting signature-related issues during development
 * 
 * @returns {Object} Test signature details including generated signature and verification results
 */
router.get("/test-signature", (req, res) => {
    try {
        // Create a test message and private key for signature testing
        const testMessage = "Test message for signature verification";
        const testPrivateKey = "0x1234567890123456789012345678901234567890123456789012345678901234";
        const wallet = new ethers.Wallet(testPrivateKey);
        
        // Generate a signature for the test message
        const testSignature = wallet.signMessage(testMessage);
        
        console.log("Test signature generation:");
        console.log("Message:", testMessage);
        console.log("Private key:", testPrivateKey);
        console.log("Generated signature:", testSignature);
        console.log("Signature length:", testSignature.length);
        
        // Verify the generated signature
        const recovered = ethers.verifyMessage(testMessage, testSignature);
        console.log("Recovered address:", recovered);
        console.log("Expected address:", wallet.address);
        
        // Return test results for debugging
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

/**
 * LOGIN ENDPOINT
 * Authenticates users using Ethereum wallet signatures
 * Verifies that the signature was created by the claimed wallet address
 * 
 * @param {string} address - The Ethereum wallet address claiming ownership
 * @param {string} signature - The cryptographic signature of the message
 * @param {string} message - The original message that was signed
 * @returns {Object} Authentication result with success status and JWT token
 */
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

        // Validate that signature is a proper hex string starting with 0x
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
            // Verify the signature using ethers.js
            const recovered = ethers.verifyMessage(message, signature);
            console.log("Recovered address:", recovered);
            
            // Check if the recovered address matches the claimed address
            if (recovered.toLowerCase() === address.toLowerCase()) {
                return res.json({ success: true, address, token: "demo_jwt_token" });
            } else {
                console.log("Address mismatch. Expected:", address.toLowerCase(), "Got:", recovered.toLowerCase());
                return res.status(401).json({ success: false, error: "Invalid signature" });
            }
        } catch (verifyError) {
            console.error("Signature verification error:", verifyError);
            
            // Additional validation and error handling for signature verification failures
            try {
                // Check if signature is a valid hexadecimal string
                if (!/^0x[a-fA-F0-9]+$/.test(signature)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: "Signature is not a valid hexadecimal string" 
                    });
                }
                
                // Try to parse signature as bytes for additional debugging
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
