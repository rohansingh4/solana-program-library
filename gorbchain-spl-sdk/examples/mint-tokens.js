const { GorbChainSDK } = require('@freekill411/gorbchain-spl-token-sdk');
const { Keypair, PublicKey } = require('@solana/web3.js');

async function mintTokensExample() {
  console.log('🪙 GorbChain Token Minting Example');
  console.log('==================================');

  // Initialize SDK
  const sdk = new GorbChainSDK();

  // Check connection
  const isReady = await sdk.isReady();
  if (!isReady) {
    console.error('❌ Cannot connect to GorbChain');
    return;
  }

  console.log('✅ Connected to GorbChain');

  // Example values (replace with real ones)
  const mintAddress = "YOUR_MINT_ADDRESS_HERE";
  const recipientAddress = "Gmhpm85fByXJ3UQH7LqJkibW2bGLz5Diatute2YNM7ny";
  const authority = Keypair.generate(); // Use your real authority keypair

  console.log(`🪙 Minting to: ${recipientAddress}`);
  console.log(`📋 Mint Address: ${mintAddress}`);

  try {
    // Mint tokens to the recipient
    const result = await sdk.tokenMinter.mintTo({
      mintAddress: mintAddress,
      recipientAddress: recipientAddress,
      amount: 100, // 100 tokens
      authority: authority,
      createTokenAccount: true
    });

    console.log('🎉 Tokens Minted Successfully!');
    console.log(`💰 Token Account: ${result.tokenAccountAddress}`);
    console.log(`🔗 Transaction: ${result.signature}`);
    console.log(`🌐 Explorer: https://explorer.gorbchain.xyz/tx/${result.signature}`);

  } catch (error) {
    console.error('❌ Error minting tokens:', error.message);
  }
}

// Run the example
mintTokensExample().catch(console.error); 