const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} = require('@solana/web3.js');

const fs = require('fs');

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const connection = new Connection(RPC_ENDPOINT, { commitment: 'confirmed' });

// Program IDs
const TOKEN_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
const ATA_PROGRAM_ID = new PublicKey('4yJEEgLC3iWcz8Qpym7AAW8XFuoUUUMrCQnecrJQdnXc');
const MINT_ADDRESS = new PublicKey('9Q9PedLGZDpNPfrHVvPiEZMhtcH2xk2h2UN1468uWkJC');

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

async function transferGUTIL(recipient, amount) {
  const wallet = loadKeypair();
  const recipientPubkey = new PublicKey(recipient);
  const ataAddress = getAssociatedTokenAddress(MINT_ADDRESS, recipientPubkey);
  
  console.log(`🚀 Transferring ${amount} GUTIL tokens...`);
  console.log(`🎯 Recipient: ${recipient}`);
  console.log(`🏦 ATA: ${ataAddress.toString()}`);
  
  const transaction = new Transaction();
  
  // Check if ATA exists
  const ataAccount = await connection.getAccountInfo(ataAddress);
  if (!ataAccount) {
    console.log('🔧 Creating ATA...');
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: ataAddress, isSigner: false, isWritable: true },
        { pubkey: recipientPubkey, isSigner: false, isWritable: false },
        { pubkey: MINT_ADDRESS, isSigner: false, isWritable: false },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: ATA_PROGRAM_ID,
      data: Buffer.alloc(0),
    }));
  }
  
  // Mint tokens
  const mintAmount = amount * Math.pow(10, 8);
  const mintData = Buffer.alloc(9);
  mintData[0] = 7; // MintTo
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
  
  const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);
  console.log(`✅ Success! Transaction: ${signature}`);
  return signature;
}

// Usage: node transfer-gutil.js <recipient> <amount>
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node transfer-gutil.js <recipient> <amount>');
    process.exit(1);
  }
  transferGUTIL(args[0], parseFloat(args[1]));
}

module.exports = { transferGUTIL };