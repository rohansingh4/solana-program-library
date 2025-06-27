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
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  getAssociatedTokenAddress,
} = require('@solana/spl-token');

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
const CUSTOM_ATA_PROGRAM_ID = new PublicKey('4yJEEgLC3iWcz8Qpym7AAW8XFuoUUUMrCQnecrJQdnXc');

// Target address to send tokens to
const RECIPIENT_ADDRESS = new PublicKey('5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ');

// Helper function to load keypair from environment or file
function loadKeypair() {
  // Option 1: From environment variable (base58 encoded private key)
  if (process.env.WALLET_PRIVATE_KEY) {
    const bs58 = require('bs58');
    return Keypair.fromSecretKey(bs58.decode(process.env.WALLET_PRIVATE_KEY));
  }
  
  // Option 2: From file (you need to create this file)
  try {
    const fs = require('fs');
    const keypairData = JSON.parse(fs.readFileSync('wallet-keypair.json', 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error('Could not load keypair from file or environment');
    throw new Error('Please set WALLET_PRIVATE_KEY environment variable or create wallet-keypair.json file');
  }
}

// Load your wallet keypair
const WALLET_KEYPAIR = loadKeypair();

async function createTokenAndTransfer() {
  try {
    console.log('🚀 Starting token creation and transfer process...');
    console.log(`Using wallet: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(WALLET_KEYPAIR.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.1 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Step 1: Create a new mint
    console.log('\n📋 Step 1: Creating new token mint...');
    const mintKeypair = Keypair.generate();
    console.log(`🪙 Mint address: ${mintKeypair.publicKey.toString()}`);

    // Get the minimum lamports for rent exemption for a mint account
    const lamports = await getMinimumBalanceForRentExemptMint(connection);

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

    // Send and confirm create mint transaction
    const createMintSignature = await sendAndConfirmTransaction(
      connection,
      createMintTx,
      [WALLET_KEYPAIR, mintKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log(`✅ Mint created! Transaction: ${createMintSignature}`);

    // Step 2: Get or create associated token account for recipient
    console.log('\n📋 Step 2: Setting up associated token account...');
    
    const recipientAta = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      RECIPIENT_ADDRESS,
      false, // allowOwnerOffCurve
      CUSTOM_TOKEN_PROGRAM_ID,
      CUSTOM_ATA_PROGRAM_ID
    );
    
    console.log(`🏦 Recipient ATA: ${recipientAta.toString()}`);

    // Check if ATA exists
    const ataAccountInfo = await connection.getAccountInfo(recipientAta);
    
    let createAtaTx = new Transaction();
    
    if (!ataAccountInfo) {
      console.log('🔧 Creating associated token account...');
      createAtaTx.add(
        createAssociatedTokenAccountInstruction(
          WALLET_KEYPAIR.publicKey, // payer
          recipientAta, // associated token account
          RECIPIENT_ADDRESS, // owner
          mintKeypair.publicKey, // mint
          CUSTOM_TOKEN_PROGRAM_ID,
          CUSTOM_ATA_PROGRAM_ID
        )
      );
    } else {
      console.log('✅ Associated token account already exists');
    }

    // Step 3: Mint tokens to the recipient
    console.log('\n📋 Step 3: Minting tokens...');
    const mintAmount = 1000 * Math.pow(10, 9); // 1000 tokens with 9 decimals
    
    createAtaTx.add(
      createMintToInstruction(
        mintKeypair.publicKey, // mint
        recipientAta, // destination
        WALLET_KEYPAIR.publicKey, // mint authority
        mintAmount, // amount
        [], // multisig signers
        CUSTOM_TOKEN_PROGRAM_ID
      )
    );

    // Send and confirm the transaction
    const mintSignature = await sendAndConfirmTransaction(
      connection,
      createAtaTx,
      [WALLET_KEYPAIR],
      { commitment: 'confirmed' }
    );
    
    console.log(`✅ Tokens minted! Transaction: ${mintSignature}`);

    // Step 4: Verify the transfer
    console.log('\n📋 Step 4: Verifying token balance...');
    const tokenBalance = await connection.getTokenAccountBalance(recipientAta);
    console.log(`🎉 Final token balance: ${tokenBalance.value.uiAmount} tokens`);

    // Summary
    console.log('\n🎊 SUCCESS! Token creation and transfer completed!');
    console.log('=' .repeat(50));
    console.log(`🪙 Token Mint: ${mintKeypair.publicKey.toString()}`);
    console.log(`🏦 Recipient ATA: ${recipientAta.toString()}`);
    console.log(`💫 Amount Transferred: ${tokenBalance.value.uiAmount} tokens`);
    console.log(`🔍 Create Mint Tx: ${createMintSignature}`);
    console.log(`🔍 Transfer Tx: ${mintSignature}`);
    console.log('=' .repeat(50));

    return {
      mintAddress: mintKeypair.publicKey.toString(),
      recipientAta: recipientAta.toString(),
      amount: tokenBalance.value.uiAmount,
      createMintTx: createMintSignature,
      transferTx: mintSignature
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run the script if called directly
if (require.main === module) {
  createTokenAndTransfer()
    .then((result) => {
      console.log('✅ Script completed successfully:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = {
  createTokenAndTransfer,
  CUSTOM_TOKEN_PROGRAM_ID,
  CUSTOM_ATA_PROGRAM_ID,
  connection
}; 