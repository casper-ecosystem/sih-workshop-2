import express from 'express'
import cors from 'cors'
import { CEP78 } from './cep78.js'
import casper_js_sdk_pkg from 'casper-js-sdk';
const { DeployUtil } = casper_js_sdk_pkg

const app = express();
const port = 3000;

app.use(express.static('./public'));

app.use(cors());
app.use(express.json());

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
});

app.get('/', (req, res) => {
  res.sendFile('public/index.html', { root: './' });
});

const cep78 = new CEP78()
cep78.setContractHash("hash-f8dda3daba7c12f7531a81ddcfe023466026d687fa0ddc4f73caa2adfc82b186")

app.get('/totalMinted', async (req, res) => {
  try {
    const total = (await cep78.totalMinted()).toString()
    res.send(total)
  } catch(error) {
    res.send(error.message)
  }
})

app.get('/balanceOf', async (req, res) => {
  try {
    const balance = (await cep78.balanceOf(req.query.pubkey)).toString()
    res.send(balance)
  } catch(error) {
    res.send(error.message)
  }
})

app.get('/ownerOf', async (req, res) => {
  try {
    const owner = (await cep78.ownerOf(req.query.tokenId)).toString()
    res.send(owner)
  } catch(error) {
    res.send(error.message)
  }
})

app.post('/sendDeploy', (req, res) => {
  const signedJSON = req.body
  let signedDeploy = DeployUtil.deployFromJson(signedJSON).unwrap();
  cep78.receiveAndSendDeploy(signedDeploy).then((response) => {
    res.send(response)
  }).catch((error) => {
    res.send(error)
  })
})
