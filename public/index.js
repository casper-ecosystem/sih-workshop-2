const client = new CasperClient("http://136.243.187.84:7777/rpc")
const contract = new Contracts.Contract(client)
contract.setContractHash("hash-f8dda3daba7c12f7531a81ddcfe023466026d687fa0ddc4f73caa2adfc82b186")

function windowLoaded() {
  checkAndSetSignerStatus();
  setActivePublicKey();
}

async function checkAndSetSignerStatus() {
  const isSignerConnectedLabel = document.getElementById("isSignerConnected");
  try {
    const isConnected = await Signer.isConnected();
    if (isConnected) {
      isSignerConnectedLabel.innerHTML = "Signer Connected?: Yes";
    } else {
      isSignerConnectedLabel.innerHTML = "Signer Connected?: No";
    }
  } catch(error) {
    isSignerConnectedLabel.innerHTML = "Signer Connected?: Error";
  }
}

async function setActivePublicKey() {
  const connectedAccountLabel = document.getElementById("connectedAccount");
  try {
    connectedAccountLabel.innerHTML = "Connected Account: " + (await Signer.getActivePublicKey());
  } catch(error) {
    connectedAccountLabel.innerHTML = "Connected Account: No active public Key"
  }
}

function connectToSigner() {
  Signer.sendConnectionRequest();
}

async function mint() {
  const mintTo = CLPublicKey.fromHex(await Signer.getActivePublicKey());

  const metadata = {
    "first_name": "John",
    "last_name": "Smith"
  };

  const args = RuntimeArgs.fromMap({
    "token_owner": CLValueBuilder.key(mintTo),
    "token_meta_data": CLValueBuilder.string(JSON.stringify(metadata))
  });

  const deploy = contract.callEntrypoint(
    "mint",
    args,
    mintTo,
    "casper-test",
    "1000000000", // 1 CSPR
    []
  );

  const deployJSON = DeployUtil.deployToJson(deploy);
  const activeKey = await Signer.getActivePublicKey();

  Signer.sign(deployJSON, activeKey).then((success) => {
    sendDeploy(success).then((response) => {
      alert(response)
    }).catch((error) => {
      alert(error)
    });
  }).catch((error) => {
    alert(error);
  });
}

async function transfer() {
  const from = CLPublicKey.fromHex(await Signer.getActivePublicKey());
  const tokenId = document.getElementById("tokenIdField").value
  const recipient = document.getElementById("transferToField").value

  const args = RuntimeArgs.fromMap({
    "token_id": CLValueBuilder.u64(tokenId),
    "target_key": CLValueBuilder.key(CLPublicKey.fromHex(recipient)),
    "source_key": CLValueBuilder.key(from),
  })

  const deploy = contract.callEntrypoint(
    "transfer",
    args,
    from,
    "casper-test",
    "1000000000", // 1 CSPR
    []
  );

  const deployJSON = DeployUtil.deployToJson(deploy);
  const activeKey = await Signer.getActivePublicKey();

  Signer.sign(deployJSON, activeKey).then((success) => {
    sendDeploy(success).then((response) => {
      alert(response)
    }).catch((error) => {
      alert(error)
    });
  }).catch((error) => {
    alert(error);
  });
}

async function balanceOf() {
  const publicKey = document.getElementById("balanceOfField").value
  axios.get("/balanceOf?pubkey=" + publicKey).then((response) => {
    alert(response.data)
  }).catch((error) => {
    alert(error.message);
  });
}

async function ownerOf() {
  const tokenId = document.getElementById("ownerOfField").value
  axios.get("/ownerOf?tokenId=" + tokenId).then((response) => {
    alert(response.data)
  }).catch((error) => {
    alert(error.message);
  });
}

async function totalMinted() {
  axios.get("/totalMinted").then((response) => {
    alert(response.data)
  }).catch((error) => {
    alert(error.message);
  });
}

function sendDeploy(signedDeployJSON) {
  return new Promise((resolve, reject) => {
    axios.post("/sendDeploy", signedDeployJSON, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).then((response) => {
      resolve(response)
    }).catch((error) => {
      reject(error);
    });
  })
}

window.onload = () => { windowLoaded() }

window.addEventListener("signer:activeKeyChanged", (msg) => {
  if (msg.detail.isConnected) {
    setActivePublicKey()
  }
});

window.addEventListener("signer:connected", (msg) => {
  checkAndSetSignerStatus()
  setActivePublicKey()
});

window.addEventListener("signer:disconnected", (msg) => {
  checkAndSetSignerStatus()
  setActivePublicKey()
});
