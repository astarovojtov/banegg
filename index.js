const express = require("express");
const ban = require("@bananocoin/bananojs");
const QRCode = require("qrcode");
const sanitize = require("sanitize-html");
const sql = require("./db");
const { getCampaigns } = require("./db");
const app = express();
const banEggWallet =
  "ban_15ybpg7b6nf6a834jwgo51yyxkg1446i7zn9itf7n17u3b9fcrr3c5nqrkcz";
const seed = process.env.BAN_SEED;
ban.bananodeApi.setUrl("https://kaliumapi.appditto.com/api");
app.use(express.json());

app.get("/test", async (req, res) => {
  const users = [
    {
      address:
        "ban_164pii33414t9gkfs6cgqeiqakjojkxfjowtjiwkf6gf8wcfjf8wpn66z8kj",
    },
    {
      address:
        "ban_3gahaiusraz8qnotf3skqn3myo74o9f7hroqw8hhny51zkkx5ikbxsbat69c",
    },
    {
      address:
        "ban_3jo4o7j3z398xy4ywmjnaoqwfo1otnyrr4ubmd3pyshggf34hhcreuc6zkcw",
    },
  ];

  const result = await sql.getUserCampaigns(
    "ban_3gahaiusraz8qnotf3skqn3myo74o9f7hroqw8hhny51zkkx5ikbxsbat69c"
  );
  res.json({ response: result });
});

app.get("/", (req, res) => {
  //return res.json("Nothing here just yet");
  return res.send(`<!DOCTYPE html>
    <html>
    <head>
        <title>BanEgg Homepage</title>
        <meta charset="utf-8" />
    </head>
    <body>
        <h1>Download extension to start the hunt</h1>
        <a href="/download">Download extension</a>
        <h2>Installation instructions</h2>
        <ul>
          <li>Download the archived file and extract on your PC</li>
          <li>Go to the browser extensions (chrome://extensions/)</li>
          <li>Click load unpacked and choose the folder you've extracted .zip to</li>
          <li>Make sure you have notifications turned on</li>
        </ul>
    </body>
    <html>`)
});

app.get('/download', (req, res) => {
  const file_system = require('fs');
  const archiver = require('archiver');
  var output = file_system.createWriteStream('./extension/extension.zip');

  var archive = archiver('zip');
  archive.on('error', function(err){
      throw err;
  });

  output.on('close', function () {
    console.log(archive.pointer() + ' total bytes');
    console.log('archiver has been finalized and the output file descriptor has closed.');
    res.sendFile(__dirname + "/extension/extension.zip");
  });

  archive.pipe(output);

  // append files from a sub-directory, putting its contents at the root of archive
  archive.directory('./extension', false);
  archive.finalize();  
});

app.post("/hide", async (req, res) => {
  const body = req.body;
  console.log(req.body);
  //{ address, url, claim_amnt, prizepool, hash /* optional */ }

  /***** check trusted event? *****/
  if (!body.url || !body.hash /* provide autogenerated one */) {
    console.log("No url or hash specified");
    return res.status(400).json({ error: "No url or hash specified" });
  }

  if (!body.prizepool) {
    console.log("Prize pool not specified");
    return res.status(400).json({ error: "Prize pool not specified" });
  }
  //check ban address valid
  if (!body.address) {
    console.log("Invalid BAN address");
    return res.status(400).json({ error: "Invalid BAN address" });
  }

  const bAddressValid = await ban.getBananoAccountValidationInfo(body.address)
    .valid;
  if (!bAddressValid) {
    console.log("Invalid BAN Address");
    return res.status(400).json({ error: "Invalid BAN Address" });
  }
  //check ban address has balance >= prizepool
  const addressInfo = await ban.getAccountInfo(body.address);
  if (addressInfo.balance_decimal < body.prizepool) {
    console.log("Insufficent funds");
    return res.status(400).json({ error: "Insufficent funds" });
  }
  //Create campaign
  const user = await sql.getUser(body.address);

  let newCamp = await sql.createCampaign({
    url: body.url,
    egg: body.hash,
    claim_amnt: body.claim_amnt,
    prizepool: body.prizepool,
    user_id: user.pop().id,
  });
  newCamp = newCamp.pop();
  //append campaign id to payment raw
  //Generate QR for payment
  //string - 'ban:ban_address?amount=amount_raw'

  const amountRaw = ban.getBananoDecimalAmountAsRaw(body.prizepool); // + newCamp.id;
  let amountSliced = appendCampaignIdToPayment(amountRaw, newCamp.id);
  console.log(amountSliced);

  const clientWallet = body.address;
  const qrString = `ban:${banEggWallet}?amount=${amountSliced}`;
  //append to raws id of
  console.log(qrString);
  const qrCode = QRCode.toDataURL(qrString, (err, url) => {
    //send to client
    return res.send({ qr: url, amountRaw: amountSliced, id: newCamp.id });
  });
});

app.post("/check-campaign-payment", async (req, res) => {
  const clientWallet = req.body.address;
  const paymentAmount = req.body.paymentAmount;
  const campId = req.body.id;
  //Ensure user payed
  //Poll hotwallet transactions
  const pollingPaymentFinishedAt = new Date(
    new Date().setMinutes(new Date().getMinutes() + 10)
  );
  const interval = setInterval(awaitPayment, 10 * 1000);
  function awaitPayment() {
    console.log(
      "Awaiting payment. Minutes left: ",
      (pollingPaymentFinishedAt - new Date()) / 1000 / 60
    );
    if (pollingPaymentFinishedAt < new Date()) {
      console.log(
        "Polling timed out, pollingPaymentFinishedAt = ",
        pollingPaymentFinishedAt.toLocaleString()
      );
      clearInterval(interval);
      return;
    }
    console.log("Querying BanEgg wallet pending");
    ban.getAccountsPending([banEggWallet], 10).then((response) => {
      // look up for trx from clients wallet with amountSliced that has if of the campaign
      const oPending = response.blocks[banEggWallet];
      const found = Object.keys(oPending).find(
        (key) => oPending[key] === paymentAmount
      );
      console.log("Found payment, clearing polling");
      if (found) {
        clearInterval(interval);
        res.json(found);

        //Recieve pending
        ban
          .receiveBananoDepositsForSeed(
            seed,
            1,
            "ban_1bananobh5rat99qfgt1ptpieie5swmoth87thi74qgbfrij7dcgjiij94xr" /* representative */
          )
          .then((res) => {
            /* response
            {
              pendingCount: 8,
              pendingBlocks: [
                '157341F4E9DCC8E2B5D61F8B570217A3FD2A593C1F78F451C2D8842C8AEF91F9',
                ...
                'F0B7F0FDD7F1A6747C8743C4E59FCBB9509503EB27EFCBA5D0E4AB495EE0E462'
              ],
              receiveCount: 8,
              receiveBlocks: [
                'B55FC9D78D9620FB86880836D4B47EF49794A40BD1D78A1F55858E9A9C69286C',
                ...
                '2A190C9541BEE0BEFB149F732D71D7EC5A1C5BD250C85FE852DE47FE4B55C2BB'
              ],
              pendingMessage: 'pending 8 blocks, of max 10.',
              receiveMessage: 'received 8 blocks.'
            }*/
            console.log("Pending recieved");
            console.log(res);
            sql
              .updateCampaignStatus({ id: campId, status: "live" })
              .then((res) => {
                console.log("Successfull payment. Campaign is live");
                res.send({ message: "Payment success. BanEgg is hidden"})
              });
          });

        //If nothing recieved during ??? minutes delete campaign
        //Clear interval in 10 minutes ???
        //Set campaign status as 'no payment recieved in 10 mins'
      }
    });
  }
});

app.get("/qwe", (req, res) => {
  ban
    .receiveBananoDepositsForSeed(
      seed,
      1,
      "ban_1bananobh5rat99qfgt1ptpieie5swmoth87thi74qgbfrij7dcgjiij94xr" /* representative */
    )
    .then((result) => {
      console.log(result);
      return res.json(result);
    });
});

app.post("/find", async (req, res) => {
  const campId = req.body.id;
  const clientWallet = req.body.address;
  
  const bAddressValid = await ban.getBananoAccountValidationInfo(clientWallet)
    .valid;
  if (!campId) {
    return res.status(400).json({ error: "No campaign id provided" });
  }
  
  if (!bAddressValid) {
    console.log("Invalid BAN Address");
    return res.status(400).json({ error: "Invalid BAN Address" });
  }

  const campaign = await sql.getCampaignById(campId);
  if (campaign[0].claim_amnt <= 0) {
    return res
      .status(400)
      .json({ error: "This egg was already found by someone" });
  }
  
  if (campaign[0].status !== "live") {
    console.log(campaign[0]);
    return res.status(400).json({ error: "No live campaigns found" });
  }

  //1. Send ban returns trx hash
  const trxHash = await ban.sendBananoWithdrawalFromSeed(
    seed,
    1,
    clientWallet,
    campaign[0].prizepool / campaign[0].claim_amnt
  ).catch(e => console.log(e));
  if (!trxHash) {
    return res.status(400).json({ error: "Something went wrong" });
  }
  //2. Decrease claim amount
  const result = await sql.countClaim(campId);
  const campStatus = await sql.updateCampaignStatus({
    id: campId,
    status: "finished",
  });
  return res.json({ status: campStatus, hash: trxHash });
});

app.get("/campaigns", async (req, res) => {
  res.json(await sql.getCampaigns());
});

app.post("/campaigns-by-url", async (req, res) => {
  const url = req.body.url;
  const result = await sql.getCampaignsByUrl(url);
  res.json(result);
});

app.post("/campaigns-by-url-hash", async (req, res) => {
  const body = req.body;
  if (!body.url || !body.hash) {
    return res.status(400).json({ message: "No url or hash provided" });
  }
  const camps = await sql.getCampaignsByUrlEgg(body.url, body.hash);
  return res.json({ camps: camps });
});

app.get("/campaignsUrl", async (req, res) => {
  const campaigns = await sql.getAllCampaigns();
  res.json(campaigns);
});

app.listen(process.env.PORT || 5000);

process.on("uncaughtException", (err) => {
  console.log(err);
});

function appendCampaignIdToPayment(raw, campId) {
  let sliced = raw.slice(0, -(campId + "").length);
  console.log(sliced);
  sliced = sliced.concat(campId);
  console.log(sliced);
  return sliced;
}