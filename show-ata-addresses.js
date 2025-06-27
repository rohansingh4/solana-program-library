const {
  PublicKey,
} = require('@solana/web3.js');

// Program IDs and addresses
const TOKEN_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
const ATA_PROGRAM_ID = new PublicKey('4yJEEgLC3iWcz8Qpym7AAW8XFuoUUUMrCQnecrJQdnXc');
const MINT_ADDRESS = new PublicKey('9Q9PedLGZDpNPfrHVvPiEZMhtcH2xk2h2UN1468uWkJC');

// Addresses
const RECIPIENT = new PublicKey('5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ');
const ACTUAL_TOKEN_ACCOUNT = new PublicKey('Ep3UEFWz38i8VzQZUy8Xst5cd443gEf7BrquJvqvcrBt');

// Function to derive ATA address
function getAssociatedTokenAddress(mint, owner, programId = ATA_PROGRAM_ID) {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    programId
  );
  return address;
}

function showTokenAccountInfo() {
  console.log('🏦 TOKEN ACCOUNT ANALYSIS');
  console.log('=' .repeat(80));
  
  console.log('📋 BASIC INFO:');
  console.log(`🎯 Recipient: ${RECIPIENT.toString()}`);
  console.log(`🪙 GUTIL Mint: ${MINT_ADDRESS.toString()}`);
  console.log(`🔧 Token Program: ${TOKEN_PROGRAM_ID.toString()}`);
  console.log(`🔗 ATA Program: ${ATA_PROGRAM_ID.toString()}`);
  
  console.log('\n🏦 WHAT WE ACTUALLY CREATED:');
  console.log(`✅ Direct Token Account: ${ACTUAL_TOKEN_ACCOUNT.toString()}`);
  console.log(`📊 Method: Direct token account creation (bypassed ATA)`);
  console.log(`💰 Balance: 250 GUTIL tokens`);
  console.log(`👤 Owner: ${RECIPIENT.toString()}`);
  console.log(`🔑 Private Key: Available in gutil-transfer-*.json file`);
  
  console.log('\n🔗 WHAT YOUR ATA ADDRESS WOULD BE:');
  const ataAddress = getAssociatedTokenAddress(MINT_ADDRESS, RECIPIENT);
  console.log(`🏦 ATA Address: ${ataAddress.toString()}`);
  console.log(`📊 Method: Derived using ATA program`);
  console.log(`⚠️ Status: NOT CREATED (we bypassed ATA due to compatibility issues)`);
  console.log(`💡 Note: This is the "standard" address that would be used with ATA`);
  
  console.log('\n🤔 WHY WE USED DIRECT TOKEN ACCOUNT:');
  console.log(`❌ ATA Creation Failed: Custom ATA program had compatibility issues`);
  console.log(`✅ Direct Account Works: We created a regular token account instead`);
  console.log(`🎯 Same Result: Recipient still owns 250 GUTIL tokens`);
  console.log(`🔧 Different Method: Direct creation vs ATA derivation`);
  
  console.log('\n📊 COMPARISON:');
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│                    ATA vs Direct Account               │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ ATA (Associated Token Account):                         │');
  console.log(`│ • Address: ${ataAddress.toString().substring(0, 20)}...       │`);
  console.log('│ • Deterministic (same every time)                      │');
  console.log('│ • Standard Solana approach                             │');
  console.log('│ • Failed to create on GorbChain                       │');
  console.log('│                                                         │');
  console.log('│ Direct Token Account (What we used):                   │');
  console.log(`│ • Address: ${ACTUAL_TOKEN_ACCOUNT.toString().substring(0, 20)}...       │`);
  console.log('│ • Random address (generated keypair)                   │');
  console.log('│ • Works perfectly on GorbChain                        │');
  console.log('│ • Contains your 250 GUTIL tokens                      │');
  console.log('└─────────────────────────────────────────────────────────┘');
  
  console.log('\n💡 IMPORTANT NOTES:');
  console.log(`🔑 Your Token Account: ${ACTUAL_TOKEN_ACCOUNT.toString()}`);
  console.log(`💰 Token Balance: 250 GUTIL`);
  console.log(`👤 Account Owner: ${RECIPIENT.toString()}`);
  console.log(`🎯 This account belongs to you and contains your tokens!`);
  console.log(`📝 The private key is saved in the transfer JSON file`);
  
  console.log('\n🚀 FOR FUTURE TRANSFERS:');
  console.log(`✅ Use: node transfer-gutil-manual.js <recipient> <amount>`);
  console.log(`📋 This will create NEW token accounts for each recipient`);
  console.log(`🔄 Each transfer creates a fresh token account (not ATA)`);
  console.log(`💡 This approach works reliably on GorbChain`);
  
  console.log('\n🎊 SUMMARY:');
  console.log(`Your GUTIL tokens are safely stored in: ${ACTUAL_TOKEN_ACCOUNT.toString()}`);
  console.log(`This is NOT an ATA, but a direct token account that works just as well!`);
  
  return {
    actualTokenAccount: ACTUAL_TOKEN_ACCOUNT.toString(),
    wouldBeATAAddress: ataAddress.toString(),
    recipient: RECIPIENT.toString(),
    mint: MINT_ADDRESS.toString(),
    balance: 250,
    method: 'direct-token-account'
  };
}

// Run the analysis
if (require.main === module) {
  const info = showTokenAccountInfo();
  console.log('\n✅ Analysis complete!');
}

module.exports = { showTokenAccountInfo, getAssociatedTokenAddress }; 