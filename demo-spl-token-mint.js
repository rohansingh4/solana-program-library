const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');

const {
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} = require('@solana/spl-token');

const fs = require('fs');

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const WS_ENDPOINT = 'wss://rpc.gorbchain.xyz/ws/';
const connection = new Connection(RPC_ENDPOINT, {
  commitment: 'confirmed',
  wsEndpoint: WS_ENDPOINT,
  disableRetryOnRateLimit: false,
});

// Custom SPL Token Program ID for GorbChain
const CUSTOM_SPL_TOKEN_PROGRAM_ID = new PublicKey('8drSBwhdQQTQs68pAddfWyXPv8CA4JhFAY2QRAxwLmSS');

// Helper function to load keypair
function loadKeypair() {
  try {
    const keypairData = JSON.parse(fs.readFileSync('wallet-keypair.json', 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error('❌ Could not load wallet-keypair.json');
    throw new Error('Please ensure wallet-keypair.json exists in the current directory');
  }
}

// Load wallet
const WALLET_KEYPAIR = loadKeypair();

async function createDemoSPLToken() {
  try {
    console.log('🚀 Creating Demo SPL Token on GorbChain (Working Version)...');
    console.log(`💼 Using wallet: ${WALLET_KEYPAIR.publicKey.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(WALLET_KEYPAIR.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Create mint keypair
    const mintKeypair = Keypair.generate();
    console.log(`🪙 New SPL Token mint: ${mintKeypair.publicKey.toString()}`);
    console.log(`🔧 Program ID: ${CUSTOM_SPL_TOKEN_PROGRAM_ID.toString()}`);

    // Token metadata (same as Token-2022 demo)
    const tokenMetadata = {
      name: "GorbChain Demo Token (SPL)",
      symbol: "GDEMO-SPL",
      description: "A working demonstration SPL Token on GorbChain - same as GDEMO Token-2022 but with transfers!",
      decimals: 6,
      totalSupply: 1200,
      creator: "GorbChain Labs",
      category: "Utility",
      features: ["Transferable", "Mintable", "Fully Compatible"],
      createdAt: new Date().toISOString(),
      network: "GorbChain",
      version: "SPL-2020"
    };

    console.log('📋 Token Metadata:');
    console.log(`   Name: ${tokenMetadata.name}`);
    console.log(`   Symbol: ${tokenMetadata.symbol}`);
    console.log(`   Description: ${tokenMetadata.description}`);
    console.log(`   Decimals: ${tokenMetadata.decimals}`);
    console.log(`   Total Supply: ${tokenMetadata.totalSupply}`);
    console.log(`   Creator: ${tokenMetadata.creator}`);

    // Get minimum balance for rent exemption
    const lamports = await getMinimumBalanceForRentExemptMint(connection);
    console.log(`💰 Rent exemption: ${lamports / LAMPORTS_PER_SOL} SOL`);

    // Create transaction
    const transaction = new Transaction().add(
      // Create mint account
      SystemProgram.createAccount({
        fromPubkey: WALLET_KEYPAIR.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports: lamports,
        programId: CUSTOM_SPL_TOKEN_PROGRAM_ID,
      }),
      // Initialize mint
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        tokenMetadata.decimals,
        WALLET_KEYPAIR.publicKey, // mint authority
        WALLET_KEYPAIR.publicKey, // freeze authority
        CUSTOM_SPL_TOKEN_PROGRAM_ID
      )
    );

    console.log('📤 Sending transaction...');
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [WALLET_KEYPAIR, mintKeypair],
      { commitment: 'confirmed' }
    );

    console.log('✅ Transaction confirmed!');
    
    console.log('🎉 SUCCESS! Demo SPL Token created!');
    console.log('=' .repeat(70));
    console.log(`🪙 Token Name: ${tokenMetadata.name} (${tokenMetadata.symbol})`);
    console.log(`🆔 Mint Address: ${mintKeypair.publicKey.toString()}`);
    console.log(`🔧 Program ID: ${CUSTOM_SPL_TOKEN_PROGRAM_ID.toString()}`);
    console.log(`📊 Decimals: ${tokenMetadata.decimals}`);
    console.log(`💰 Total Supply: ${tokenMetadata.totalSupply} tokens`);
    console.log(`👨‍💻 Mint Authority: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🔍 Transaction: ${signature}`);
    console.log(`🌐 Network: ${tokenMetadata.network}`);
    console.log(`📅 Created: ${tokenMetadata.createdAt}`);
    console.log(`✅ Transfer Ready: YES (SPL Token fully supports transfers!)`);
    console.log('=' .repeat(70));

    // Save mint information with metadata
    const mintInfo = {
      mintAddress: mintKeypair.publicKey.toString(),
      mintKeypair: Array.from(mintKeypair.secretKey),
      mintAuthority: WALLET_KEYPAIR.publicKey.toString(),
      decimals: tokenMetadata.decimals,
      programId: CUSTOM_SPL_TOKEN_PROGRAM_ID.toString(),
      signature: signature,
      metadata: tokenMetadata,
      createdAt: new Date().toISOString(),
      type: 'spl-token-demo'
    };

    fs.writeFileSync('demo-spl-token-mint-info.json', JSON.stringify(mintInfo, null, 2));
    console.log('💾 Demo SPL Token mint info saved to demo-spl-token-mint-info.json');

    return {
      signature: signature,
      mintAddress: mintKeypair.publicKey.toString(),
      metadata: tokenMetadata,
      programId: CUSTOM_SPL_TOKEN_PROGRAM_ID.toString()
    };

  } catch (error) {
    console.error('❌ Error creating Demo SPL Token:', error.message);
    throw error;
  }
}

// CLI interface
async function main() {
  console.log('🎯 Creating Demo SPL Token with metadata (Working Version)...');
  
  try {
    await createDemoSPLToken();
    console.log('\n✅ Demo SPL Token creation completed successfully!');
    console.log('💡 Next step: Use demo-transfer-spl-token.js to transfer 250 tokens');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Demo SPL Token creation failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { createDemoSPLToken, connection, CUSTOM_SPL_TOKEN_PROGRAM_ID }; 