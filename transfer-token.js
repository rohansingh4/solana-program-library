const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  SystemProgram,
} = require('@solana/web3.js');

const {
  createMintToInstruction,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
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
const CUSTOM_ATA_PROGRAM_ID = new PublicKey('4yJEEgLC3iWcz8Qpym7AAW8XFuoUUUMrCQnecrJQdnXc');

// Target recipient address
const RECIPIENT_ADDRESS = new PublicKey('5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ');

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

// Helper function to load mint info
function loadMintInfo() {
  try {
    const mintData = JSON.parse(fs.readFileSync('token-mint-info.json', 'utf8'));
    return {
      mintAddress: new PublicKey(mintData.mintAddress),
      mintKeypair: Keypair.fromSecretKey(new Uint8Array(mintData.mintKeypair)),
      decimals: mintData.decimals
    };
  } catch (error) {
    console.error('❌ Could not load token-mint-info.json');
    console.log('💡 Please run mint-token.js first to create a token');
    throw new Error('Token mint info not found. Run mint-token.js first.');
  }
}

// Load wallet and mint info
const WALLET_KEYPAIR = loadKeypair();

// Custom function to create ATA instruction with our custom program IDs
function createCustomAssociatedTokenAccountInstruction(
  payer,
  associatedToken,
  owner,
  mint,
  tokenProgramId = CUSTOM_TOKEN_PROGRAM_ID,
  associatedTokenProgramId = CUSTOM_ATA_PROGRAM_ID
) {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId: associatedTokenProgramId,
    data: Buffer.alloc(0), // Empty data for ATA creation
  });
}

async function transferTokens(amount = 1000) {
  try {
    console.log('🚀 Transferring tokens on GorbChain...');
    console.log(`💼 Using wallet: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🎯 Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    
    // Load mint information
    const mintInfo = loadMintInfo();
    console.log(`🪙 Token mint: ${mintInfo.mintAddress.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(WALLET_KEYPAIR.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.05 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees (need at least 0.05 SOL)');
    }

    // Calculate associated token address for recipient
    const recipientAta = await getAssociatedTokenAddress(
      mintInfo.mintAddress,
      RECIPIENT_ADDRESS,
      false,
      CUSTOM_TOKEN_PROGRAM_ID,
      CUSTOM_ATA_PROGRAM_ID
    );
    
    console.log(`🏦 Recipient ATA: ${recipientAta.toString()}`);

    // Check if ATA exists
    const ataAccountInfo = await connection.getAccountInfo(recipientAta);
    
    const transaction = new Transaction();
    
    if (!ataAccountInfo) {
      console.log('🔧 Creating associated token account...');
      transaction.add(
        createCustomAssociatedTokenAccountInstruction(
          WALLET_KEYPAIR.publicKey, // payer
          recipientAta, // associated token account
          RECIPIENT_ADDRESS, // owner
          mintInfo.mintAddress, // mint
          CUSTOM_TOKEN_PROGRAM_ID,
          CUSTOM_ATA_PROGRAM_ID
        )
      );
    } else {
      console.log('✅ Associated token account already exists');
    }

    // Calculate amount with decimals
    const mintAmount = amount * Math.pow(10, mintInfo.decimals);
    console.log(`📊 Minting ${amount} tokens (${mintAmount} base units)`);
    
    // Add mint instruction
    transaction.add(
      createMintToInstruction(
        mintInfo.mintAddress, // mint
        recipientAta, // destination
        WALLET_KEYPAIR.publicKey, // mint authority
        mintAmount, // amount
        [], // multisig signers
        CUSTOM_TOKEN_PROGRAM_ID
      )
    );

    console.log('📤 Sending transaction...');
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [WALLET_KEYPAIR],
      { commitment: 'confirmed' }
    );

    console.log('✅ Transaction confirmed!');

    // Verify the balance
    const tokenBalance = await connection.getTokenAccountBalance(recipientAta);
    
    console.log('🎉 SUCCESS! Tokens transferred successfully!');
    console.log('=' .repeat(50));
    console.log(`🪙 Token Mint: ${mintInfo.mintAddress.toString()}`);
    console.log(`👤 Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    console.log(`🏦 Recipient ATA: ${recipientAta.toString()}`);
    console.log(`💰 Amount Sent: ${amount} tokens`);
    console.log(`📊 Current Balance: ${tokenBalance.value.uiAmount} tokens`);
    console.log(`🔍 Transaction: ${signature}`);
    console.log('=' .repeat(50));

    return {
      signature: signature,
      amount: amount,
      recipientAta: recipientAta.toString(),
      currentBalance: tokenBalance.value.uiAmount
    };

  } catch (error) {
    console.error('❌ Error transferring tokens:', error.message);
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  let amount = 1000; // default amount
  
  // Check if amount is provided as argument
  if (args.length > 0) {
    const providedAmount = parseFloat(args[0]);
    if (isNaN(providedAmount) || providedAmount <= 0) {
      console.error('❌ Invalid amount. Please provide a positive number.');
      console.log('💡 Usage: node transfer-token.js [amount]');
      console.log('💡 Example: node transfer-token.js 500');
      process.exit(1);
    }
    amount = providedAmount;
  }
  
  console.log(`🎯 Preparing to transfer ${amount} tokens...`);
  
  try {
    await transferTokens(amount);
    console.log('\n✅ Transfer completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Transfer failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { transferTokens, connection, CUSTOM_TOKEN_PROGRAM_ID, CUSTOM_ATA_PROGRAM_ID }; 