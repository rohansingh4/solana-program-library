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

const fs = require('fs');

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const connection = new Connection(RPC_ENDPOINT, { commitment: 'confirmed' });

// Program IDs
const TOKEN_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
const MINT_ADDRESS = new PublicKey('9Q9PedLGZDpNPfrHVvPiEZMhtcH2xk2h2UN1468uWkJC');

// Token account size (165 bytes for Token-2022)
const TOKEN_ACCOUNT_SIZE = 165;

// Load wallet
function loadKeypair() {
  const keypairData = JSON.parse(fs.readFileSync('wallet-keypair.json', 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

async function transferGUTILSimple(recipient, amount) {
  try {
    const wallet = loadKeypair();
    const recipientPubkey = new PublicKey(recipient);
    
    console.log(`🚀 Transferring ${amount} GUTIL tokens (Simple Method)...`);
    console.log(`💼 From wallet: ${wallet.publicKey.toString()}`);
    console.log(`🎯 To recipient: ${recipient}`);
    console.log(`🪙 Token mint: ${MINT_ADDRESS.toString()}`);
    console.log(`🔧 Token program: ${TOKEN_PROGRAM_ID.toString()}`);
    
    // Create a new token account for the recipient
    const tokenAccountKeypair = Keypair.generate();
    const tokenAccountAddress = tokenAccountKeypair.publicKey;
    
    console.log(`🏦 Creating token account: ${tokenAccountAddress.toString()}`);
    
    // Get minimum balance for rent exemption
    const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_SIZE);
    console.log(`💰 Rent exemption: ${lamports / LAMPORTS_PER_SOL} SOL`);
    
    const transaction = new Transaction();
    
    // Create token account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: tokenAccountAddress,
        space: TOKEN_ACCOUNT_SIZE,
        lamports: lamports,
        programId: TOKEN_PROGRAM_ID,
      })
    );
    
    // Initialize token account
    const initializeAccountData = Buffer.alloc(1);
    initializeAccountData[0] = 1; // InitializeAccount instruction
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: tokenAccountAddress, isSigner: false, isWritable: true },
        { pubkey: MINT_ADDRESS, isSigner: false, isWritable: false },
        { pubkey: recipientPubkey, isSigner: false, isWritable: false },
        { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
      ],
      programId: TOKEN_PROGRAM_ID,
      data: initializeAccountData,
    }));
    
    // Mint tokens to the account
    console.log(`💰 Minting ${amount} tokens (${amount * Math.pow(10, 8)} units)...`);
    const mintAmount = amount * Math.pow(10, 8); // 8 decimals
    const mintData = Buffer.alloc(9);
    mintData[0] = 7; // MintTo instruction
    mintData.writeBigUInt64LE(BigInt(mintAmount), 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: MINT_ADDRESS, isSigner: false, isWritable: true },
        { pubkey: tokenAccountAddress, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: TOKEN_PROGRAM_ID,
      data: mintData,
    }));
    
    console.log('📤 Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection, 
      transaction, 
      [wallet, tokenAccountKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log('✅ SUCCESS! GUTIL tokens transferred!');
    console.log('=' .repeat(60));
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`💰 Amount: ${amount} GUTIL tokens`);
    console.log(`🎯 Recipient: ${recipient}`);
    console.log(`🏦 Token Account: ${tokenAccountAddress.toString()}`);
    console.log(`🪙 Token Mint: ${MINT_ADDRESS.toString()}`);
    console.log(`🌐 Network: GorbChain`);
    console.log(`📊 Decimals: 8`);
    console.log(`🔧 Method: Direct Token Account (No ATA)`);
    console.log('=' .repeat(60));
    
    // Save transfer details
    const transferInfo = {
      signature: signature,
      recipient: recipient,
      tokenAccount: tokenAccountAddress.toString(),
      tokenAccountKeypair: Array.from(tokenAccountKeypair.secretKey),
      mintAddress: MINT_ADDRESS.toString(),
      amount: amount,
      decimals: 8,
      timestamp: new Date().toISOString(),
      method: 'direct-token-account',
      tokenSymbol: 'GUTIL',
      tokenName: 'GorbChain Utility Token'
    };
    
    fs.writeFileSync(`gutil-transfer-${Date.now()}.json`, JSON.stringify(transferInfo, null, 2));
    console.log(`💾 Transfer details saved to gutil-transfer-${Date.now()}.json`);
    
    return {
      signature,
      tokenAccount: tokenAccountAddress.toString(),
      amount,
      recipient
    };
    
  } catch (error) {
    console.error('❌ Transfer failed:', error.message);
    if (error.logs) {
      console.error('📜 Transaction logs:', error.logs);
    }
    throw error;
  }
}

// Usage: node transfer-gutil-simple.js <recipient> <amount>
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node transfer-gutil-simple.js <recipient> <amount>');
    console.log('Example: node transfer-gutil-simple.js 5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ 250');
    process.exit(1);
  }
  
  const recipient = args[0];
  const amount = parseFloat(args[1]);
  
  if (isNaN(amount) || amount <= 0) {
    console.error('❌ Invalid amount. Please provide a positive number.');
    process.exit(1);
  }
  
  transferGUTILSimple(recipient, amount).catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { transferGUTILSimple }; 