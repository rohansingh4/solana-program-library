const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} = require('@solana/web3.js');

const {
  createInitializeAccountInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptAccount,
  ACCOUNT_SIZE,
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

// Load wallet
const WALLET_KEYPAIR = loadKeypair();

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

    // Create a new token account for the recipient
    const tokenAccountKeypair = Keypair.generate();
    console.log(`🏦 Token account: ${tokenAccountKeypair.publicKey.toString()}`);

    // Get minimum balance for rent exemption
    const lamportsForAccount = await getMinimumBalanceForRentExemptAccount(connection);

    const transaction = new Transaction();
    
    // Create the token account
    console.log('🔧 Creating token account...');
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: WALLET_KEYPAIR.publicKey,
        newAccountPubkey: tokenAccountKeypair.publicKey,
        space: ACCOUNT_SIZE,
        lamports: lamportsForAccount,
        programId: CUSTOM_TOKEN_PROGRAM_ID,
      }),
      // Initialize the token account
      createInitializeAccountInstruction(
        tokenAccountKeypair.publicKey, // account
        mintInfo.mintAddress, // mint
        RECIPIENT_ADDRESS, // owner
        CUSTOM_TOKEN_PROGRAM_ID
      )
    );

    // Calculate amount with decimals
    const mintAmount = amount * Math.pow(10, mintInfo.decimals);
    console.log(`📊 Minting ${amount} tokens (${mintAmount} base units)`);
    
    // Add mint instruction
    transaction.add(
      createMintToInstruction(
        mintInfo.mintAddress, // mint
        tokenAccountKeypair.publicKey, // destination
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
      [WALLET_KEYPAIR, tokenAccountKeypair],
      { commitment: 'confirmed' }
    );

    console.log('✅ Transaction confirmed!');
    
    console.log('🎉 SUCCESS! Tokens transferred successfully!');
    console.log('=' .repeat(50));
    console.log(`🪙 Token Mint: ${mintInfo.mintAddress.toString()}`);
    console.log(`👤 Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    console.log(`🏦 Token Account: ${tokenAccountKeypair.publicKey.toString()}`);
    console.log(`💰 Amount Sent: ${amount} tokens`);
    console.log(`🔍 Transaction: ${signature}`);
    console.log('=' .repeat(50));

    // Save token account info
    const accountInfo = {
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      owner: RECIPIENT_ADDRESS.toString(),
      mint: mintInfo.mintAddress.toString(),
      amount: amount,
      signature: signature,
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync('token-account-info.json', JSON.stringify(accountInfo, null, 2));
    console.log('💾 Token account info saved to token-account-info.json');

    return {
      signature: signature,
      amount: amount,
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      recipient: RECIPIENT_ADDRESS.toString()
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
      console.log('💡 Usage: node transfer-token-simple.js [amount]');
      console.log('💡 Example: node transfer-token-simple.js 500');
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

module.exports = { transferTokens, connection, CUSTOM_TOKEN_PROGRAM_ID }; 