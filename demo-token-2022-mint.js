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
  createMintToInstruction,
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

// Custom Token-2022 Program ID for GorbChain
const CUSTOM_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');

// Token-2022 mint size (larger than regular token)
const TOKEN_2022_MINT_SIZE = 82;

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

async function createDemoToken2022() {
  try {
    console.log('🚀 Creating Demo Token-2022 on GorbChain...');
    console.log(`💼 Using wallet: ${WALLET_KEYPAIR.publicKey.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(WALLET_KEYPAIR.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Create mint keypair
    const mintKeypair = Keypair.generate();
    console.log(`🪙 New Token-2022 mint: ${mintKeypair.publicKey.toString()}`);
    console.log(`🔧 Program ID: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);

    // Token metadata
    const tokenMetadata = {
      name: "GorbChain Demo Token",
      symbol: "GDEMO",
      description: "A demonstration Token-2022 on GorbChain with advanced features",
      decimals: 6,
      totalSupply: 1200,
      creator: "GorbChain Labs",
      category: "Utility",
      features: ["Extensible", "Upgradeable", "Metadata Support"],
      createdAt: new Date().toISOString(),
      network: "GorbChain",
      version: "2022"
    };

    console.log('📋 Token Metadata:');
    console.log(`   Name: ${tokenMetadata.name}`);
    console.log(`   Symbol: ${tokenMetadata.symbol}`);
    console.log(`   Description: ${tokenMetadata.description}`);
    console.log(`   Decimals: ${tokenMetadata.decimals}`);
    console.log(`   Total Supply: ${tokenMetadata.totalSupply}`);
    console.log(`   Creator: ${tokenMetadata.creator}`);

    // Get minimum balance for rent exemption
    const mintSpace = TOKEN_2022_MINT_SIZE;
    const lamports = await connection.getMinimumBalanceForRentExemption(mintSpace);
    console.log(`💰 Rent exemption: ${lamports / LAMPORTS_PER_SOL} SOL`);

    // Create transaction
    const transaction = new Transaction().add(
      // Create mint account
      SystemProgram.createAccount({
        fromPubkey: WALLET_KEYPAIR.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintSpace,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      }),
      // Initialize mint
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        tokenMetadata.decimals,
        WALLET_KEYPAIR.publicKey, // mint authority
        WALLET_KEYPAIR.publicKey, // freeze authority
        CUSTOM_TOKEN_2022_PROGRAM_ID
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
    
    console.log('🎉 SUCCESS! Demo Token-2022 created!');
    console.log('=' .repeat(70));
    console.log(`🪙 Token Name: ${tokenMetadata.name} (${tokenMetadata.symbol})`);
    console.log(`🆔 Mint Address: ${mintKeypair.publicKey.toString()}`);
    console.log(`🔧 Program ID: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`📊 Decimals: ${tokenMetadata.decimals}`);
    console.log(`💰 Total Supply: ${tokenMetadata.totalSupply} tokens`);
    console.log(`👨‍💻 Mint Authority: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🔍 Transaction: ${signature}`);
    console.log(`🌐 Network: ${tokenMetadata.network}`);
    console.log(`📅 Created: ${tokenMetadata.createdAt}`);
    console.log('=' .repeat(70));

    // Save mint information with metadata
    const mintInfo = {
      mintAddress: mintKeypair.publicKey.toString(),
      mintKeypair: Array.from(mintKeypair.secretKey),
      mintAuthority: WALLET_KEYPAIR.publicKey.toString(),
      decimals: tokenMetadata.decimals,
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      signature: signature,
      metadata: tokenMetadata,
      extensions: [],
      createdAt: new Date().toISOString(),
      type: 'token-2022-demo'
    };
    // now mint the account to the wallet
    const mintTransaction = new Transaction().add(
      createMintToInstruction(
        
        mintKeypair.publicKey,
        WALLET_KEYPAIR.publicKey,
        WALLET_KEYPAIR.publicKey,
        tokenMetadata.totalSupply
      )
    );
    const signature2 = await sendAndConfirmTransaction(
      connection,
      mintTransaction,
      [WALLET_KEYPAIR, mintKeypair],
      { commitment: 'confirmed' }
    );

    console.log('✅ Transaction confirmed!');
    console.log('🎉 SUCCESS! Demo Token-2022 minted to wallet!');
    console.log('=' .repeat(70));
    console.log(`🪙 Token Name: ${tokenMetadata.name} (${tokenMetadata.symbol})`);
    console.log(`🆔 Mint Address: ${mintKeypair.publicKey.toString()}`);
    console.log(`🔧 Program ID: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`📊 Decimals: ${tokenMetadata.decimals}`);

    fs.writeFileSync('demo-token-2022-mint-info.json', JSON.stringify(mintInfo, null, 2));
    console.log('💾 Demo Token-2022 mint info saved to demo-token-2022-mint-info.json');

    return {
      signature: signature,
      mintAddress: mintKeypair.publicKey.toString(),
      metadata: tokenMetadata,
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString()
    };

  } catch (error) {
    console.error('❌ Error creating Demo Token-2022:', error.message);
    throw error;
  }
}

// CLI interface
async function main() {
  console.log('🎯 Creating Demo Token-2022 with metadata...');
  
  try {
    await createDemoToken2022();
    console.log('\n✅ Demo Token-2022 creation completed successfully!');
    console.log('💡 Next step: Use demo-transfer-token-2022.js to transfer 250 tokens');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Demo Token-2022 creation failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { createDemoToken2022, connection, CUSTOM_TOKEN_2022_PROGRAM_ID }; 