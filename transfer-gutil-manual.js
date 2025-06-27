const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  SystemProgram,
} = require('@solana/web3.js');

const fs = require('fs');

// GorbChain Configuration - HTTP only
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const connection = new Connection(RPC_ENDPOINT, { 
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
});

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

// Manual transaction confirmation
async function confirmTransaction(signature, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const status = await connection.getSignatureStatus(signature);
      if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
        return status.value;
      }
      if (status?.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      }
      console.log(`⏳ Waiting for confirmation... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Transaction confirmation timeout');
}

async function transferGUTILManual(recipient, amount) {
  try {
    const wallet = loadKeypair();
    const recipientPubkey = new PublicKey(recipient);
    
    console.log(`🚀 Transferring ${amount} GUTIL tokens (Manual Method)...`);
    console.log(`💼 From wallet: ${wallet.publicKey.toString()}`);
    console.log(`🎯 To recipient: ${recipient}`);
    console.log(`🪙 Token mint: ${MINT_ADDRESS.toString()}`);
    console.log(`🔧 Token program: ${TOKEN_PROGRAM_ID.toString()}`);
    console.log(`🌐 RPC: ${RPC_ENDPOINT}`);
    
    // Create a new token account for the recipient
    const tokenAccountKeypair = Keypair.generate();
    const tokenAccountAddress = tokenAccountKeypair.publicKey;
    
    console.log(`🏦 Creating token account: ${tokenAccountAddress.toString()}`);
    
    // Get minimum balance for rent exemption
    const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_SIZE);
    console.log(`💰 Rent exemption: ${lamports / LAMPORTS_PER_SOL} SOL`);
    
    // Get recent blockhash
    console.log('🔍 Getting recent blockhash...');
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    });
    
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
    
    // Sign transaction
    console.log('✍️ Signing transaction...');
    transaction.sign(wallet, tokenAccountKeypair);
    
    // Send transaction manually
    console.log('📤 Sending transaction manually...');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });
    
    console.log(`📋 Transaction signature: ${signature}`);
    console.log('⏳ Confirming transaction...');
    
    // Manually confirm transaction
    const confirmationStatus = await confirmTransaction(signature);
    
    console.log('✅ SUCCESS! GUTIL tokens transferred!');
    console.log('=' .repeat(60));
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`📊 Status: ${confirmationStatus.confirmationStatus}`);
    console.log(`💰 Amount: ${amount} GUTIL tokens`);
    console.log(`🎯 Recipient: ${recipient}`);
    console.log(`🏦 Token Account: ${tokenAccountAddress.toString()}`);
    console.log(`🪙 Token Mint: ${MINT_ADDRESS.toString()}`);
    console.log(`🌐 Network: GorbChain (Manual)`);
    console.log(`📊 Decimals: 8`);
    console.log(`🔧 Method: Direct Token Account (Manual Confirmation)`);
    console.log(`🔗 Explorer: https://explorer.gorbchain.xyz/tx/${signature}`);
    console.log('=' .repeat(60));
    
    // Save transfer details
    const transferInfo = {
      signature: signature,
      confirmationStatus: confirmationStatus.confirmationStatus,
      recipient: recipient,
      tokenAccount: tokenAccountAddress.toString(),
      tokenAccountKeypair: Array.from(tokenAccountKeypair.secretKey),
      mintAddress: MINT_ADDRESS.toString(),
      amount: amount,
      decimals: 8,
      timestamp: new Date().toISOString(),
      method: 'direct-token-account-manual',
      tokenSymbol: 'GUTIL',
      tokenName: 'GorbChain Utility Token',
      explorerUrl: `https://explorer.gorbchain.xyz/tx/${signature}`
    };
    
    const filename = `gutil-transfer-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(transferInfo, null, 2));
    console.log(`💾 Transfer details saved to ${filename}`);
    
    return {
      signature,
      tokenAccount: tokenAccountAddress.toString(),
      amount,
      recipient,
      confirmationStatus: confirmationStatus.confirmationStatus
    };
    
  } catch (error) {
    console.error('❌ Transfer failed:', error.message);
    if (error.logs) {
      console.error('📜 Transaction logs:', error.logs);
    }
    throw error;
  }
}

// Usage: node transfer-gutil-manual.js <recipient> <amount>
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node transfer-gutil-manual.js <recipient> <amount>');
    console.log('Example: node transfer-gutil-manual.js 5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ 250');
    process.exit(1);
  }
  
  const recipient = args[0];
  const amount = parseFloat(args[1]);
  
  if (isNaN(amount) || amount <= 0) {
    console.error('❌ Invalid amount. Please provide a positive number.');
    process.exit(1);
  }
  
  transferGUTILManual(recipient, amount).catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { transferGUTILManual }; 