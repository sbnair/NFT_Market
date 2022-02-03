#!/usr/bin/env ts-node
import * as dotenv from "dotenv";
import * as fs from 'fs';
import { program } from 'commander';
import log from 'loglevel';
import { web3 } from '@project-serum/anchor';

import { createNewNFT } from './commands/createNFT';
import { updateNFT } from './commands/updateNFT';
import { purchaseNFT } from './commands/purchaseNFT';
import { upload } from './commands/upload';
import { getAllNFTs } from './commands/fetchAll';

import { loadWalletKey } from './helpers/accounts';
import {
  parsePrice,
} from './helpers/various';
import {
  EXTENSION_JPG,
  EXTENSION_PNG,
} from './helpers/constants';

dotenv.config({ path: __dirname+'/.env' });

program.version('0.0.1');
log.setLevel('info');

programCommand('create_test')
  .option('-n, --name <string>', 'test name')
  .option('-u, --uri <string>', 'test image')
  .option('-p, --price <string>', 'test price')
  .option('-o, --owner <string>', 'owner nft mint address')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
      name,
      uri,
      price,
      owner,
    } = cmd.opts();

    let parsedPrice = parsePrice(price);
    if (price && isNaN(parsedPrice)) {
      throw new Error(`Price is not valid. Please input as valid float type.`);
    }

    const solConnection = new web3.Connection(web3.clusterApiUrl(env));
    const programId = process.env.TEST_METADATA_PROGRAM_ID;
    log.info(`Test program Id: ${programId.toString()}`);
    if (!programId) {
      throw new Error(`Test Program Id is not provided in .env file`);
    }
    const walletKeyPair = loadWalletKey(keypair);
    log.info(`create_test: n-${name}, u-${uri}, p-${parsedPrice}, o-${owner}`);
    await createNewNFT(solConnection, programId, walletKeyPair, {name, uri, price: parsedPrice, ownerNftAddress: owner});
  });

programCommand('show_all')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
    } = cmd.opts();

    const solConnection = new web3.Connection(web3.clusterApiUrl(env));
    const programId = process.env.TEST_METADATA_PROGRAM_ID;
    if (!programId) {
      throw new Error(`Test Program Id is not provided in .env file`);
    }
    log.info(`show_all: e-${env} env-${programId}`);
    const nftList = await getAllNFTs(solConnection, programId);
    log.info(nftList);
  });

programCommand('update_test_price')
  .option('-i, --id <number>', 'test Id')
  .option('-p, --price <string>', 'new test price')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
      id,
      price,
    } = cmd.opts();

    let parsedPrice = parsePrice(price);
    if (price && isNaN(parsedPrice)) {
      throw new Error(`Price is not valid. Please input as valid float type.`);
    }

    const solConnection = new web3.Connection(web3.clusterApiUrl(env));
    const programId = process.env.TEST_METADATA_PROGRAM_ID;
    if (!programId) {
      throw new Error(`Test Program Id is not provided in .env file`);
    }
    const walletKeyPair = loadWalletKey(keypair);
    log.info(`update_test_price: i-${id}, p-${parsedPrice}`);
    await updateNFT(solConnection, programId, walletKeyPair, id, parsedPrice);
  });

programCommand('buy_test')
  .option('-i, --id <number>', 'test Id')
  .option('-n, --name <string>', 'new test name')
  .option('-u, --uri <string>', 'new test image')
  .option('-p, --price <string>', 'new test price as Sol')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
      id,
      name,
      uri,
      price,
    } = cmd.opts();

    let parsedPrice = parsePrice(price);
    if (price && isNaN(parsedPrice)) {
      throw new Error(`Price is not valid. Please input as valid float type.`);
    }

    const solConnection = new web3.Connection(web3.clusterApiUrl(env));
    const programId = process.env.TEST_METADATA_PROGRAM_ID;
    if (!programId) {
      throw new Error(`Test Program Id is not provided in .env file`);
    }
    const walletKeyPair = loadWalletKey(keypair);
    let wallet = walletKeyPair.publicKey;
    log.info(`buy_test: i-${id}, n-${name}, u-${uri}, p-${parsedPrice}`);
    await purchaseNFT(solConnection, programId, env, walletKeyPair, id, name, uri, parsedPrice);
  });

programCommand('upload_image')
  .argument(
    '<file>',
    'Image file path to upload',
  )
  .option(
    '-s, --storage <string>',
    'Database to use for storage (arweave, ipfs, aws)',
    'arweave',
  )
  .option(
    '--ipfs-infura-project-id <string>',
    'Infura IPFS project id (required if using IPFS)',
  )
  .option(
    '--ipfs-infura-secret <string>',
    'Infura IPFS scret key (required if using IPFS)',
  )
  .option(
    '--aws-s3-bucket <string>',
    '(existing) AWS S3 Bucket name (required if using aws)',
  )
  .action(async (imgFile: string, options, cmd) => {
    if(!fs.existsSync(imgFile)) {
      throw new Error(`Image file not exist. Please check the image path.`);
    }

    const {
      keypair,
      env,
      storage,
      ipfsInfuraProjectId,
      ipfsInfuraSecret,
      awsS3Bucket,
    } = cmd.opts();

    if (storage === 'ipfs' && (!ipfsInfuraProjectId || !ipfsInfuraSecret)) {
      throw new Error(
        'IPFS selected as storage option but Infura project id or secret key were not provided.',
      );
    }
    if (storage === 'aws' && !awsS3Bucket) {
      throw new Error(
        'aws selected as storage option but existing bucket name (--aws-s3-bucket) not provided.',
      );
    }
    if (!(storage === 'arweave' || storage === 'ipfs' || storage === 'aws')) {
      throw new Error(
        "Storage option must either be 'arweave', 'ipfs', or 'aws'.",
      );
    }
    const ipfsCredentials = {
      projectId: ipfsInfuraProjectId,
      secretKey: ipfsInfuraSecret,
    };

    const isPngFile = imgFile.endsWith(EXTENSION_PNG);
    const isJpgFile = imgFile.endsWith(EXTENSION_JPG);

    if (!isPngFile && !isJpgFile) {
      throw new Error(
        `Image extension should be png or jpg.`,
      );
    }
    const solConnection = new web3.Connection(web3.clusterApiUrl(env));

    log.info(`Beginning the upload for ${isJpgFile ? `jpg` : `png`} image file`);

    const startMs = Date.now();
    log.info('started at: ' + startMs.toString());
    let warn = false;
    for (;;) {
      const successful = await upload(
        solConnection,
        imgFile,
        env,
        keypair,
        storage,
        ipfsCredentials,
        awsS3Bucket,
      );

      if (successful) {
        warn = false;
        break;
      } else {
        warn = true;
        log.warn('upload was not successful, rerunning');
      }
    }
    const endMs = Date.now();
    const timeTaken = new Date(endMs - startMs).toISOString().substr(11, 8);
    log.info(
      `ended at: ${new Date(endMs).toISOString()}. time taken: ${timeTaken}`,
    );
    if (warn) {
      log.info('not all images have been uploaded, rerun this step.');
    }
  });

function programCommand(name: string) {
  return program
    .command(name)
    .option(
      '-e, --env <string>',
      'Solana cluster env name',
      'testnet', //mainnet-beta, testnet, devnet
    )
    .option(
      '-k, --keypair <path>',
      `Solana wallet location`,
      '--keypair not provided',
    )
    .option('-l, --log-level <string>', 'log level', setLogLevel);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setLogLevel(value, prev) {
  if (value === undefined || value === null) {
    return;
  }
  log.info('setting the log value to: ' + value);
  log.setLevel(value);
}

program.parse(process.argv);
