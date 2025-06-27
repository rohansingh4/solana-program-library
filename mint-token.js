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

// Custom Program IDs for GorbChain
const CUSTOM_TOKEN_PROGRAM_ID = new PublicKey('8drSBwhdQQTQs68pAddfWyXPv8CA4JhFAY2QRAxwLmSS');

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

async function createToken() {
  try {
    console.log('🪙 Creating SPL Token on GorbChain...');
    console.log(`💼 Using wallet: ${WALLET_KEYPAIR.publicKey.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(WALLET_KEYPAIR.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.1 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees (need at least 0.1 SOL)');
    }

    // Create a new mint keypair
    const mintKeypair = Keypair.generate();
    console.log(`🎯 New token mint address: ${mintKeypair.publicKey.toString()}`);

    // Get the minimum lamports for rent exemption
    const lamports = await getMinimumBalanceForRentExemptMint(connection);
    console.log(`💸 Rent for mint account: ${lamports / LAMPORTS_PER_SOL} SOL`);

    // Create mint account transaction
    const createMintTx = new Transaction().add(
      // Create mint account
      SystemProgram.createAccount({
        fromPubkey: WALLET_KEYPAIR.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports: lamports,
        programId: CUSTOM_TOKEN_PROGRAM_ID,
      }),
      // Initialize mint
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        9, // decimals
        WALLET_KEYPAIR.publicKey, // mint authority
        WALLET_KEYPAIR.publicKey, // freeze authority
        CUSTOM_TOKEN_PROGRAM_ID
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

    console.log('🎉 SUCCESS! Token created successfully!');
    console.log('=' .repeat(50));
    console.log(`🪙 Token Mint Address: ${mintKeypair.publicKey.toString()}`);
    console.log(`🔍 Transaction Signature: ${signature}`);
    console.log(`⚡ Decimals: 9`);
    console.log(`👤 Mint Authority: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🔒 Freeze Authority: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log('=' .repeat(50));

    // Save mint information to file for transfer script
    const mintInfo = {
      mintAddress: mintKeypair.publicKey.toString(),
      mintKeypair: Array.from(mintKeypair.secretKey),
      mintAuthority: WALLET_KEYPAIR.publicKey.toString(),
      decimals: 9,
      signature: signature,
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync('token-mint-info.json', JSON.stringify(mintInfo, null, 2));
    console.log('💾 Token info saved to token-mint-info.json');
    console.log('🚀 You can now use transfer-token.js to send tokens!');

    return {
      mintAddress: mintKeypair.publicKey.toString(),
      signature: signature,
      mintAuthority: WALLET_KEYPAIR.publicKey.toString()
    };

  } catch (error) {
    console.error('❌ Error creating token:', error.message);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  createToken()
    .then((result) => {
      console.log('\n✅ Token creation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Token creation failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createToken, connection, CUSTOM_TOKEN_PROGRAM_ID }; 