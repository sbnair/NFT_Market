import {
  updateNFTMetadataInstruction,
} from '../helpers/instructions';
import { sendTransactionWithRetryWithKeypair } from '../helpers/transactions';
import {
  getNFTDataKey,
} from '../helpers/accounts';
import * as anchor from '@project-serum/anchor';
import {
  NFTdata,
  UpdateNFTMetadataArgs,
  METADATA_SCHEMA,
} from '../helpers/schema';
import { serialize } from 'borsh';
import { TOKEN_PROGRAM_ID } from '../helpers/constants';
import { getProgramAccounts, decodeNFTMetadata } from './fetchAll';
import { AccountLayout, u64 } from '@solana/spl-token';
import {
  Keypair,
  Connection,
  TransactionInstruction,
  PublicKey,
} from '@solana/web3.js';
import BN from 'bn.js';
import log from 'loglevel';

export const updateNFT = async (
  connection: Connection,
  nftProgramAddress: string,
  walletKeypair: Keypair,
  id: number,
  price: number,
): Promise<void> => {
  // Validate nftData
  if (
    isNaN(price)
  ) {
    log.error('Invalid price', price);
    return;
  }

  log.info(price);
  // Create wallet from keypair
  const wallet = new anchor.Wallet(walletKeypair);
  if (!wallet?.publicKey) return;

  const programId = new PublicKey(nftProgramAddress);
  
  const instructions: TransactionInstruction[] = [];
  const signers: anchor.web3.Keypair[] = [walletKeypair];

  // Update metadata
  let nftdataAccount = await getNFTDataKey(id, programId);
  log.info(`Generated test account: ${nftdataAccount}`);
  
  const result = await getProgramAccounts(
    connection,
    nftProgramAddress,
    {},
  );
  const count = result.length;
  log.info(`Fetched test counts: ${count}`);
  if (id > count) {
    log.error('Invalid id ', count);
    return;
  }

  let ownerNftAddress: PublicKey;
  for(let nft of result) {
    const accountPubkey = nft.pubkey;
    if (accountPubkey == nftdataAccount.toBase58()) {
      const decoded: NFTdata = await decodeNFTMetadata(nft.account.data);
      ownerNftAddress = new PublicKey(decoded.ownerNftAddress);
      break;
    }
  };
  log.info(`Retrived owner nft address: ${ownerNftAddress}`);

  const fetchData = await getProgramAccounts(
    connection,
    TOKEN_PROGRAM_ID.toBase58(),
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: ownerNftAddress.toBase58(),
          },
        },
        {
          dataSize: 165
        },
      ],
    },
  );
  let accountPubkey: string;
  let accountOwnerPubkey: string;
  for(let token of fetchData) {
    accountPubkey = token.pubkey;
    let accountData = deserializeAccount(token.account.data);
    if (accountData.amount == 1) {
      accountOwnerPubkey = accountData.owner;
      break;
    }
  };
  log.info(`Token account address: ${accountPubkey}`);
  log.info(`Token account owner: ${accountOwnerPubkey}`);

  let txnData = Buffer.from(
    serialize(
      METADATA_SCHEMA,
      new UpdateNFTMetadataArgs({ id, price: new BN(price) }),
    ),
  );
  
  instructions.push(
    updateNFTMetadataInstruction(
      nftdataAccount,
      wallet.publicKey,
      new PublicKey(accountPubkey),
      txnData,
      programId,
    ),
  );

  const res = await sendTransactionWithRetryWithKeypair(
    connection,
    walletKeypair,
    instructions,
    signers,
  );

  try {
    await connection.confirmTransaction(res.txid, 'max');
  } catch {
    // ignore
  }

  // Force wait for max confirmations
  await connection.getParsedConfirmedTransaction(res.txid, 'confirmed');
  log.info('Test NFT created', res.txid);
  return ;
};

export const deserializeAccount = (data: Buffer) => {
  const accountInfo = AccountLayout.decode(data);
  accountInfo.mint = new PublicKey(accountInfo.mint);
  accountInfo.owner = new PublicKey(accountInfo.owner);
  accountInfo.amount = u64.fromBuffer(accountInfo.amount);

  return accountInfo;
};
