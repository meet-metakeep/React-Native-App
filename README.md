# SVM Transaction Broadcasting (Android)

This app demonstrates MetaKeep SDK integration in React Native for Solana transactions on Android. It initializes MetaKeep, retrieves the SVM wallet, builds a Solana v0 transaction using @solana/web3.js, signs via MetaKeep, and broadcasts to Devnet.

## Prerequisites
- Node 22+
- Java 21+
- Android SDK 26+ and an Android v14 device or emulator

## Install
```bash
git clone https://github.com/meet-metakeep/React-Native-App.git
cd React-Native-App
npm install
```

## Configure MetaKeep
- App ID is set in `App.tsx` as:
```
const METAKEEP_APP_ID = ''; // 
```


Update android/app/build.gradle and App.tsx with your solana app id

- Android deep link callback is configured in `android/app/build.gradle` via `manifestPlaceholders` and in `AndroidManifest.xml`.

## Solana Web3
- Uses `@solana/web3.js@1.98.4` with React Native friendly polyfills defined in `index.js` (`react-native-get-random-values`, URL polyfill, and Buffer).
- RPC: `https://api.devnet.solana.com`.

## How it works
- Initialize MetaKeep once on app start
- Get wallet address: `sdk.getWallet()`
- Build versioned transaction with recent blockhash
- Serialize the message and request signature from MetaKeep
- Attach signature and broadcast using `sendRawTransaction`

Key flow in `App.tsx`:
```ts
const sdk = new MetaKeep(METAKEEP_APP_ID);
const { wallet } = await sdk.getWallet();

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const feePayer = new PublicKey(wallet.solAddress);
const recipient = new PublicKey('BCf7PuGsv2yQFRJ9GATZafg4L4LrV6vkfYwmS3jVREvM');
const { blockhash } = await connection.getLatestBlockhash();

const messageV0 = new TransactionMessage({
  payerKey: feePayer,
  recentBlockhash: blockhash,
  instructions: [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
    SystemProgram.transfer({ fromPubkey: feePayer, toPubkey: recipient, lamports: 1_000_000 }), // 0.001 SOL
  ],
}).compileToV0Message();

const tx = new VersionedTransaction(messageV0);
const serializedTransactionMessage = '0x' + Buffer.from(tx.message.serialize()).toString('hex');

const { signature } = await sdk.signTransaction({ serializedTransactionMessage }, 'transfer 1 SOL');
tx.addSignature(feePayer, Buffer.from(signature.replace(/^0x/, ''), 'hex'));

const sig = await connection.sendRawTransaction(Buffer.from(tx.serialize()), { skipPreflight: true });
```

## Run (Android only)
Start Metro once, then build and launch the app:
```bash
npm start -- --reset-cache
# In another terminal
npx react-native run-android
```

## Notes
- The UI shows the connected wallet address and provides a button to sign and send 0.001 SOL to the fixed recipient.
- After success, a link is provided to open the transaction on Solscan (Devnet).
- No iOS instructions are included; this project targets Android exclusively.
