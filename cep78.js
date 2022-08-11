import casper_js_sdk_pkg from 'casper-js-sdk';
import ts_results_pkg from 'ts-results'
import fs from 'fs'
const { RuntimeArgs, CLValueBuilder, Contracts, CasperClient, DeployUtil, CLPublicKey, Keys, CLValue, CLType, CLKey } = casper_js_sdk_pkg
const { Option, Some } = ts_results_pkg


export class CEP78 {
  constructor(contractHash) {
    this.keyPairFilePath = "keys/secret_key.pem"
    this.keys = this.getKeys()
    this.network = "casper-test"
    this.client = new CasperClient("http://136.243.187.84:7777/rpc")
    this.contract = new Contracts.Contract(this.client)
    this.collection_name = "SIH Workshop NFT Test"
    this.collection_symbol = "SIH"
    if (contractHash != null) {
      this.setContractHash(contractHash)
    }
  }

  setContractHash(contractHash) {
    this.contract.setContractHash(contractHash)
  }

  async installContract() {
    return new Promise((resolve, reject) => {

      const schema = {
        "properties": {
          "first_name": {
            "name": "First Name",
            "description": "Token holder's first name",
            "required": true
          },
          "last_name": {
            "name": "Last Name",
            "description": "Token holder's last name",
            "required": true
          }
        }
      }

      const args = RuntimeArgs.fromMap({
        "collection_name": CLValueBuilder.string(this.collection_name),
        "collection_symbol": CLValueBuilder.string(this.collection_symbol),
        "total_token_supply": CLValueBuilder.u64(1000),
        "ownership_mode": CLValueBuilder.u8(2), // Transferable
        "nft_kind": CLValueBuilder.u8(1), // Digital
        "holder_mode": CLValueBuilder.u8(0), // 
        "nft_metadata_kind": CLValueBuilder.u8(3),
        "json_schema": CLValueBuilder.string(JSON.stringify(schema)),
        "identifier_mode": CLValueBuilder.u8(0),
        "metadata_mutability": CLValueBuilder.u8(0)
      });

      const deploy = this.contract.install(
        CEP78.getWasm("contract.wasm"),
        args,
        "180000000000", //180 CSPR
        this.keys.publicKey,
        this.network,
        [this.keys]
      )

      this.putAndGetDeploy(deploy).then((result) => {
        const hash = CEP78.iterateTransforms(result)
        this.setContractHash(hash)
        resolve(hash)
      }).catch((error) => {
        reject(error)
      })
    })
  }

  async mint() {
    return new Promise((resolve, reject) => {
      if (this.contract.contractHash == null) {
        reject("No contract hash")
      }

      const metadata = {
        "first_name": "John",
        "last_name": "Smith"
      }

      const args = RuntimeArgs.fromMap({
        "token_owner": CLValueBuilder.key(this.keys.publicKey),
        "token_meta_data": CLValueBuilder.string(JSON.stringify(metadata))
      })

      const deploy = this.contract.callEntrypoint(
        "mint",
        args,
        this.keys.publicKey,
        this.network,
        "1000000000", // 1 CSPR
        [this.keys]
      )

      this.putAndGetDeploy(deploy).then((result) => {
        resolve(result)
      }).catch((error) => {
        reject(error)
      })
    })
  }

  async transfer(tokenId, recipient) {
    return new Promise((resolve, reject) => {
      if (this.contract.contractHash == null) {
        reject("No contract hash")
      }

      const args = RuntimeArgs.fromMap({
        "token_id": CLValueBuilder.u64(tokenId),
        "target_key": CLValueBuilder.key(CLPublicKey.fromHex(recipient)),
        "source_key": CLValueBuilder.key(this.keys.publicKey),
      })

      const deploy = this.contract.callEntrypoint(
        "transfer",
        args,
        this.keys.publicKey,
        this.network,
        "1000000000", // 1 CSPR
        [this.keys]
      )

      this.putAndGetDeploy(deploy).then((result) => {
        resolve(result)
      }).catch((error) => {
        reject(error)
      })
    })
  }

  receiveAndSendDeploy(deploy) {
    return new Promise((resolve, reject) => {
      if (this.contract.contractHash == null) {
        reject("No contract hash")
      }
      this.putAndGetDeploy(deploy).then((result) => {
        resolve(result)
      }).catch((error) => {
        reject(error)
      })
    })
  }

  async balanceOf(account) {
    return new Promise((resolve, reject) => {
      if (this.contract.contractHash == null) {
        reject("No contract hash")
      }

      this.contract.queryContractDictionary(
        "balances",
        CLPublicKey.fromHex(account).toAccountHashStr().substring(13),
      ).then((response) => {
        resolve(parseInt(response.data._hex, 16))
      }).catch((error) => {
        reject(error)
      })
    })
  }

  async ownerOf(tokenId) {
    return new Promise((resolve, reject) => {
      if (this.contract.contractHash == null) {
        reject("No contract hash")
      }
      this.contract.queryContractDictionary(
        "token_owners",
        tokenId.toString(),
      ).then((response) => {
        resolve(Buffer.from(response.data.data).toString('hex'))
      }).catch((error) => {
        reject(error)
      })
    })
  }

  async totalMinted() {
    return new Promise((resolve, reject) => {
      if (this.contract.contractHash == null) {
        reject("No contract hash")
      }

      this.contract.queryContractData(
        ["number_of_minted_tokens"],
      ).then((response) => {
        resolve(parseInt(response._hex, 16))
      }).catch((error) => {
        reject(error)
      })
    })
  }

  static getWasm(file) {
    try {
      return new Uint8Array(fs.readFileSync(file).buffer)
    } catch (err) {
      console.error(err)
    }
  }

  getKeys() {
    return Keys.Ed25519.loadKeyPairFromPrivateFile(this.keyPairFilePath)
  }

  putAndGetDeploy(deploy) {
    return new Promise((resolve, reject) => {
      this.client.putDeploy(deploy).then((deployHash) => {
        this.pollDeployment(deployHash).then((response) => {
          resolve(response)
        }).catch((error) => {
          reject(error)
        })
      }).catch((error) => {
        reject(error)
      })
    })
  }

  pollDeployment(deployHash) {
    const client = this.client
    return new Promise((resolve, reject) => {
      var poll = setInterval(async function(deployHash) {
        try {
          const response = await client.getDeploy(deployHash)
      	  if (response[1].execution_results.length != 0) {
             //Deploy executed
             if (response[1].execution_results[0].result.Failure != null) {
               clearInterval(poll)
               reject("Deployment failed")
               return
             }
             clearInterval(poll)
             resolve(response[1].execution_results[0].result.Success)
           }
    	  } catch(error) {
          console.error(error)
    	  }
      }, 2000, deployHash)
    })
  }

  static iterateTransforms(result) {
    const transforms = result.effect.transforms
    for (var i = 0; i < transforms.length; i++) {
      if (transforms[i].transform == "WriteContract") {
        return transforms[i].key
      }
    }
  }
}

async function test() {
  const cep78 = new CEP78()
  try {
    const nftRecipient = Keys.Ed25519.loadKeyPairFromPrivateFile("recipient/secret_key.pem").publicKey.toHex()

    console.log("New CEP78 Installation. Contract hash: ", await cep78.installContract())
    console.log("New mint executed. ", await cep78.mint())
    console.log("New transfer to ", nftRecipient, await cep78.transfer(0, nftRecipient))
    console.log("Account hash of token id 0 is ", await cep78.ownerOf(0))
    console.log("Balance Of ", nftRecipient, " is ", await cep78.balanceOf(nftRecipient))
    console.log("The total number of minted NFTs is ", await cep78.totalMinted())
  } catch(error) {
    console.error(error)
  }
}

test()