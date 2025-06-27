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
const ATA_PROGRAM_ID = new PublicKey('4yJEEgLC3iWcz8Qpym7AAW8XFuoUUUMrCQnecrJQdnXc');
const MINT_ADDRESS = new PublicKey('9Q9PedLGZDpNPfrHVvPiEZMhtcH2xk2h2UN1468uWkJC');
const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
const RENT_PROGRAM_ID = new PublicKey('SysvarRent111111111111111111111111111111111');

// Load wallet
function loadKeypair() {
  const keypairData = JSON.parse(fs.readFileSync('wallet-keypair.json', 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Derive ATA address
function getAssociatedTokenAddress(mint, owner) {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM_ID
  );
  return address;
}

// Create ATA instruction with proper format
function createAssociatedTokenAccountInstruction(
  payer,
  associatedToken,
  owner,
  mint
) {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: RENT_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ATA_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
}

async function transferGUTIL(recipient, amount) {
  try {
    const wallet = loadKeypair();
    const recipientPubkey = new PublicKey(recipient);
    const ataAddress = getAssociatedTokenAddress(MINT_ADDRESS, recipientPubkey);
    
    console.log(`🚀 Transferring ${amount} GUTIL tokens...`);
    console.log(`💼 From wallet: ${wallet.publicKey.toString()}`);
    console.log(`🎯 To recipient: ${recipient}`);
    console.log(`🏦 Recipient ATA: ${ataAddress.toString()}`);
    console.log(`🪙 Token mint: ${MINT_ADDRESS.toString()}`);
    console.log(`🔧 Token program: ${TOKEN_PROGRAM_ID.toString()}`);
    console.log(`🔗 ATA program: ${ATA_PROGRAM_ID.toString()}`);
    
    const transaction = new Transaction();
    
    // Check if ATA exists
    console.log('🔍 Checking if ATA exists...');
    const ataAccount = await connection.getAccountInfo(ataAddress);
    if (!ataAccount) {
      console.log('🔧 ATA does not exist, creating it...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          ataAddress,
          recipientPubkey,
          MINT_ADDRESS
        )
      );
    } else {
      console.log('✅ ATA already exists');
    }
    
    // Mint tokens directly to the ATA
    console.log(`💰 Minting ${amount} tokens (${amount * Math.pow(10, 8)} units)...`);
    const mintAmount = amount * Math.pow(10, 8); // 8 decimals
    const mintData = Buffer.alloc(9);
    mintData[0] = 7; // MintTo instruction
    mintData.writeBigUInt64LE(BigInt(mintAmount), 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: MINT_ADDRESS, isSigner: false, isWritable: true },
        { pubkey: ataAddress, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: TOKEN_PROGRAM_ID,
      data: mintData,
    }));
    
    console.log('📤 Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection, 
      transaction, 
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log('✅ SUCCESS! GUTIL tokens transferred!');
    console.log('=' .repeat(60));
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`💰 Amount: ${amount} GUTIL tokens`);
    console.log(`🎯 Recipient: ${recipient}`);
    console.log(`🏦 Token Account: ${ataAddress.toString()}`);
    console.log(`🪙 Token Mint: ${MINT_ADDRESS.toString()}`);
    console.log(`🌐 Network: GorbChain`);
    console.log('=' .repeat(60));
    
    return signature;
  } catch (error) {
    console.error('❌ Transfer failed:', error.message);
    if (error.logs) {
      console.error('📜 Transaction logs:', error.logs);
    }
    throw error;
  }
}

// Usage: node transfer-gutil-fixed.js <recipient> <amount>
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node transfer-gutil-fixed.js <recipient> <amount>');
    console.log('Example: node transfer-gutil-fixed.js 5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ 250');
    process.exit(1);
  }
  
  const recipient = args[0];
  const amount = parseFloat(args[1]);
  
  if (isNaN(amount) || amount <= 0) {
    console.error('❌ Invalid amount. Please provide a positive number.');
    process.exit(1);
  }
  
  transferGUTIL(recipient, amount).catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { transferGUTIL }; 