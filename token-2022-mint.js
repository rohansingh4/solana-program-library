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

// Custom Token-2022 Program ID for GorbChain
const CUSTOM_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');

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

// Load wallet keypair
const WALLET_KEYPAIR = loadKeypair();

async function createToken2022(decimals = 9, extensions = []) {
  try {
    console.log('🪙 Creating SPL Token-2022 on GorbChain...');
    console.log(`💼 Using wallet: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🔧 Token-2022 Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(WALLET_KEYPAIR.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.1 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees (need at least 0.1 SOL)');
    }

    // Create a new mint keypair
    const mintKeypair = Keypair.generate();
    console.log(`🎯 New Token-2022 mint address: ${mintKeypair.publicKey.toString()}`);

    // Calculate space needed (base mint size + extensions)
    let mintSpace = MINT_SIZE;
    console.log(`📏 Base mint space: ${mintSpace} bytes`);
    
    // For Token-2022, we might need additional space for extensions
    // This is a simplified version - in practice, you'd calculate based on specific extensions
    if (extensions.length > 0) {
      mintSpace += extensions.length * 32; // Rough estimate
      console.log(`📏 Extended mint space: ${mintSpace} bytes (with ${extensions.length} extensions)`);
    }

    // Get the minimum lamports for rent exemption
    const lamports = await connection.getMinimumBalanceForRentExemption(mintSpace);
    console.log(`💸 Rent for mint account: ${lamports / LAMPORTS_PER_SOL} SOL`);

    // Create mint account transaction
    const createMintTx = new Transaction().add(
      // Create mint account
      SystemProgram.createAccount({
        fromPubkey: WALLET_KEYPAIR.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintSpace,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      }),
      // Initialize mint (Token-2022 uses same instruction as Token)
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        WALLET_KEYPAIR.publicKey, // mint authority
        WALLET_KEYPAIR.publicKey, // freeze authority
        CUSTOM_TOKEN_2022_PROGRAM_ID
      )
    );

    console.log('📤 Sending transaction...');
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      createMintTx,
      [WALLET_KEYPAIR, mintKeypair],
      { commitment: 'confirmed' }
    );

    console.log('🎉 SUCCESS! Token-2022 created successfully!');
    console.log('=' .repeat(60));
    console.log(`🪙 Token-2022 Mint Address: ${mintKeypair.publicKey.toString()}`);
    console.log(`🔍 Transaction Signature: ${signature}`);
    console.log(`⚡ Decimals: ${decimals}`);
    console.log(`👤 Mint Authority: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🔒 Freeze Authority: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🔧 Program ID: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log('=' .repeat(60));

    // Save mint information to file for transfer script
    const mintInfo = {
      mintAddress: mintKeypair.publicKey.toString(),
      mintKeypair: Array.from(mintKeypair.secretKey),
      mintAuthority: WALLET_KEYPAIR.publicKey.toString(),
      decimals: decimals,
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      signature: signature,
      extensions: extensions,
      createdAt: new Date().toISOString(),
      type: 'token-2022'
    };

    fs.writeFileSync('token-2022-mint-info.json', JSON.stringify(mintInfo, null, 2));
    console.log('💾 Token-2022 info saved to token-2022-mint-info.json');
    console.log('🚀 You can now use transfer-token-2022.js to send tokens!');

    return {
      mintAddress: mintKeypair.publicKey.toString(),
      signature: signature,
      mintAuthority: WALLET_KEYPAIR.publicKey.toString(),
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString()
    };

  } catch (error) {
    console.error('❌ Error creating Token-2022:', error.message);
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  let decimals = 9; // default decimals
  
  // Check if decimals is provided as argument
  if (args.length > 0) {
    const providedDecimals = parseInt(args[0]);
    if (isNaN(providedDecimals) || providedDecimals < 0 || providedDecimals > 9) {
      console.error('❌ Invalid decimals. Please provide a number between 0-9.');
      console.log('💡 Usage: node token-2022-mint.js [decimals]');
      console.log('💡 Example: node token-2022-mint.js 6');
      process.exit(1);
    }
    decimals = providedDecimals;
  }
  
  console.log(`🎯 Creating Token-2022 with ${decimals} decimals...`);
  
  try {
    await createToken2022(decimals);
    console.log('\n✅ Token-2022 creation completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Token-2022 creation failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { createToken2022, connection, CUSTOM_TOKEN_2022_PROGRAM_ID }; 