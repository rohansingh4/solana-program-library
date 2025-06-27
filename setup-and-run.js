const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔧 GorbChain Token Minter Setup');
console.log('='.repeat(40));

// Step 1: Check if we need to create a separate project directory
function setupProject() {
  console.log('📁 Setting up project...');
  
  // Copy the package.json
  if (fs.existsSync('gorbchain-token-package.json')) {
    fs.copyFileSync('gorbchain-token-package.json', 'package.json');
    console.log('✅ Package.json configured');
  }
  
  // Install dependencies
  try {
    console.log('📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

// Step 2: Create wallet keypair file from Solana CLI
function createWalletKeypair() {
  console.log('\n🔑 Setting up wallet keypair...');
  
  // Check if wallet keypair already exists
  if (fs.existsSync('wallet-keypair.json')) {
    console.log('✅ Wallet keypair already exists');
    return;
  }
  
  try {
    // Try to copy from default Solana CLI location
    const defaultKeypairPath = require('os').homedir() + '/.config/solana/id.json';
    
    if (fs.existsSync(defaultKeypairPath)) {
      fs.copyFileSync(defaultKeypairPath, 'wallet-keypair.json');
      console.log('✅ Wallet keypair copied from Solana CLI');
    } else {
      console.log('⚠️  Default Solana keypair not found');
      console.log('Please create wallet-keypair.json manually or set WALLET_PRIVATE_KEY environment variable');
      
      // Create example file
      const exampleKeypair = {
        note: "Replace this array with your actual secret key bytes from: solana-keygen new --outfile wallet-keypair.json --no-bip39-passphrase",
        secretKey: [/* your 64-byte secret key array here */]
      };
      
      fs.writeFileSync('wallet-keypair-example.json', JSON.stringify(exampleKeypair, null, 2));
      console.log('📝 Created wallet-keypair-example.json for reference');
    }
  } catch (error) {
    console.error('❌ Error setting up wallet:', error.message);
  }
}

// Step 3: Create environment example
function createEnvExample() {
  console.log('\n📝 Creating environment example...');
  
  const envExample = `# GorbChain Token Minter Configuration
# Option 1: Use base58 encoded private key
# WALLET_PRIVATE_KEY=your_base58_encoded_private_key_here

# Option 2: Use wallet-keypair.json file (default)
# Make sure wallet-keypair.json exists in the project root

# Network Configuration (already configured in script)
# RPC_ENDPOINT=https://rpc.gorbchain.xyz
# WS_ENDPOINT=wss://rpc.gorbchain.xyz/ws/

# Custom Program IDs (already configured)
# TOKEN_PROGRAM_ID=8drSBwhdQQTQs68pAddfWyXPv8CA4JhFAY2QRAxwLmSS
# ATA_PROGRAM_ID=4yJEEgLC3iWcz8Qpym7AAW8XFuoUUUMrCQnecrJQdnXc

# Target recipient address (configured in script)
# RECIPIENT_ADDRESS=5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ
`;
  
  fs.writeFileSync('.env.example', envExample);
  console.log('✅ Created .env.example file');
}

// Step 4: Run the token minting script
function runMintScript() {
  console.log('\n🚀 Running token minting script...');
  console.log('='.repeat(40));
  
  try {
    // Import and run the minting script
    require('./mint-and-transfer-token.js');
  } catch (error) {
    console.error('❌ Failed to run minting script:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure wallet-keypair.json exists with your actual keypair');
    console.log('2. Or set WALLET_PRIVATE_KEY environment variable');
    console.log('3. Ensure you have sufficient SOL balance');
    console.log('4. Check network connectivity to GorbChain RPC');
  }
}

// Main setup function
async function main() {
  try {
    setupProject();
    createWalletKeypair();
    createEnvExample();
    
    console.log('\n✅ Setup completed!');
    console.log('\n🔧 Next steps:');
    console.log('1. Ensure wallet-keypair.json contains your actual secret key');
    console.log('2. Run: node mint-and-transfer-token.js');
    console.log('3. Or run: npm run mint');
    
    // Ask if user wants to run the script now
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\n🤔 Do you want to run the token minting script now? (y/n): ', (answer) => {
      rl.close();
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        runMintScript();
      } else {
        console.log('👋 Setup complete! Run the script when ready.');
      }
    });
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  main();
}

module.exports = { setupProject, createWalletKeypair, createEnvExample }; 