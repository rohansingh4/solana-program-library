# @freekill411/gorbchain-spl-token-sdk

🚀 **Simplified SDK for creating, minting, and transferring SPL/Token-2022 tokens on GorbChain**

[![npm version](https://badge.fury.io/js/@freekill411%2Fgorbchain-spl-token-sdk.svg)](https://www.npmjs.com/package/@freekill411/gorbchain-spl-token-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🌟 Features

- ✅ **Easy Token Creation**: Create Token-2022 tokens with metadata
- ✅ **Simple Minting**: Mint tokens to any address with automatic account creation
- ✅ **GorbChain Optimized**: Built specifically for GorbChain's custom program IDs
- ✅ **TypeScript Support**: Full type definitions included
- ✅ **Error Handling**: Comprehensive error messages and retry logic
- ✅ **Connection Management**: Auto-configured for GorbChain RPC

## 📦 Installation

```bash
npm install @freekill411/gorbchain-spl-token-sdk
```

## 🚀 Quick Start

### Basic Usage

```javascript
import { GorbChainSDK } from '@freekill411/gorbchain-spl-token-sdk';
import { Keypair } from '@solana/web3.js';

// Initialize the SDK
const sdk = new GorbChainSDK();

// Create your authority keypair (save this securely!)
const authority = Keypair.generate();

// Create a new token
const token = await sdk.tokenMinter.createToken2022({
  name: "My Token",
  symbol: "MTK",
  decimals: 9,
  supply: 1000000, // 1 million tokens
  authority: authority
});

console.log(`Token created: ${token.mintAddress}`);
console.log(`Transaction: ${token.signature}`);
```

### Advanced Usage

```javascript
import { 
  GorbChainConnection, 
  TokenMinter 
} from '@freekill411/gorbchain-spl-token-sdk';

// Custom connection
const connection = new GorbChainConnection({
  commitment: 'finalized',
  disableRetryOnRateLimit: false
});

// Create token minter
const minter = new TokenMinter(connection);

// Create token with custom settings
const token = await minter.createToken2022({
  name: "GorbCoin",
  symbol: "GORB", 
  decimals: 6,
  supply: 0, // Create mint without initial supply
  authority: authority,
  freezeAuthority: null // No freeze authority
});

// Later, mint tokens to specific addresses
await minter.mintTo({
  mintAddress: token.mintAddress,
  recipientAddress: "Gmhpm85fByXJ3UQH7LqJkibW2bGLz5Diatute2YNM7ny",
  amount: 1000,
  authority: authority
});
```

## 🎯 Examples

### Create a Simple Token

```javascript
const { GorbChainSDK } = require('@freekill411/gorbchain-spl-token-sdk');
const { Keypair } = require('@solana/web3.js');

async function createMyToken() {
  const sdk = new GorbChainSDK();
  const authority = Keypair.generate();
  
  const token = await sdk.tokenMinter.createToken2022({
    name: "DemoToken",
    symbol: "DEMO",
    decimals: 9,
    supply: 100000,
    authority
  });
  
  console.log(`✅ Token: ${token.mintAddress}`);
  console.log(`🔗 TX: ${token.signature}`);
}
```

## 🌐 GorbChain Program IDs

This SDK automatically uses GorbChain's custom program IDs:

- **Token-2022**: `2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An`
- **ATA Program**: `BWBbPGpceCtFCUuMFjYUYpHEnagcT58bNi9c44VJ4rkW`
- **SPL Token**: `8drSBwhdQQTQs68pAddfWyXPv8CA4JhFAY2QRAxwLmSS`

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ for the GorbChain ecosystem 