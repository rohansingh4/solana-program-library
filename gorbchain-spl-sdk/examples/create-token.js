const { GorbChainSDK } = require('@freekill411/gorbchain-spl-token-sdk');
const { Keypair } = require('@solana/web3.js');

async function createTokenExample() {
  console.log('🚀 GorbChain Token Creation Example');
  console.log('===================================');

  // Initialize SDK
  const sdk = new GorbChainSDK();

  // Check if GorbChain is accessible
  const isReady = await sdk.isReady();
  if (!isReady) {
    console.error('❌ Cannot connect to GorbChain');
    return;
  }

  console.log('✅ Connected to GorbChain');

  // Get network info
  const networkInfo = await sdk.getNetworkInfo();
  console.log('📊 Network Info:', networkInfo);

  // Create a new keypair for this example (you'd use your own)
  const authority = Keypair.generate();
  console.log(`👤 Authority: ${authority.publicKey.toString()}`);

  try {
    // Create a new token
    const tokenInfo = await sdk.tokenMinter.createToken2022({
      name: "Example Token",
      symbol: "EXAMPLE",
      decimals: 9,
      supply: 1000000, // 1 million tokens
      authority: authority
    });

    console.log('🎉 Token Created Successfully!');
    console.log(`🪙 Mint Address: ${tokenInfo.mintAddress}`);
    console.log(`💰 Token Account: ${tokenInfo.tokenAccountAddress}`);
    console.log(`📊 Supply: ${tokenInfo.supply} tokens`);
    console.log(`🔗 Transaction: ${tokenInfo.signature}`);
    console.log(`🌐 Explorer: https://explorer.gorbchain.xyz/tx/${tokenInfo.signature}`);

  } catch (error) {
    console.error('❌ Error creating token:', error.message);
  }
}

// Run the example
createTokenExample().catch(console.error); 