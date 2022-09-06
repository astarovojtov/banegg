const express = require("express");
const ban = require("@bananocoin/bananojs");
const QRCode = require("qrcode");
const sanitize = require("sanitize-html");
const sql = require("./db");
const jwt = require("jsonwebtoken");
const app = express();
const banEggWallet =
  "ban_15ybpg7b6nf6a834jwgo51yyxkg1446i7zn9itf7n17u3b9fcrr3c5nqrkcz";
const seed = process.env.BAN_SEED;
const waitingForPaymentCountdown = 10; //10 mins
const auth = require("./middleware/auth");

ban.bananodeApi.setUrl("https://kaliumapi.appditto.com/api");
app.use(express.json());

app.get("/", (req, res) => {
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
    <html>`);
});

app.get("/download", (req, res) => {
  const file_system = require("fs");
  const archiver = require("archiver");
  var output = file_system.createWriteStream("./extension/extension.zip");

  var archive = archiver("zip");
  archive.on("error", function (err) {
    throw err;
  });

  output.on("close", function () {
    console.log(archive.pointer() + " total bytes");
    console.log(
      "archiver has been finalized and the output file descriptor has closed."
    );
    res.sendFile(__dirname + "/extension/extension.zip");
  });

  archive.pipe(output);

  // append files from a sub-directory, putting its contents at the root of archive
  archive.directory("./extension", false);
  archive.finalize();
});

// app.get("/users", async (req, res) => {
//   res.json(await sql.getUsers());
// });
app.get('/test', async (req, res) => {
  res.json(await sql.getUser('ban_3pnnnjossihu83bewqcz49jhsicazsb17abm78x8x3cg8kkd48hf6fr8y8k5'));
}); 
app.post("/hide", async (req, res) => {
  const logger = [],
    body = req.body,
    url = sanitize(body.url),
    hash = sanitize(body.hash),
    prizepool = sanitize(body.prizepool),
    address = sanitize(body.address),
    claim_amnt = sanitize(body.claim_amnt);

  if (!url || !hash ) {
    console.log("No url or hash specified");
    return res.status(400).json({ error: "No url or hash specified" });
  }
  logger.push(`Url: ${url}`);

  if (!prizepool) {
    console.log("Prize pool not specified");
    return res.status(400).json({ error: "Prize pool not specified" });
  }
  logger.push(`Prize: ${prizepool}`);
  //check ban address valid
  if (!address) {
    console.log("BAN address was not provided");
    return res.status(400).json({ error: "BAN address was not provided" });
  }
  logger.push(`Address: ${address}`);

  const bAddressValid = await ban.getBananoAccountValidationInfo(address)
    .valid;
  if (!bAddressValid) {
    console.log("Invalid BAN Address");
    return res.status(400).json({ error: "Invalid BAN Address" });
  }
  logger.push(`Address: valid`);
  //check ban address has balance >= prizepool
  const addressInfo = await ban.getAccountInfo(address);
  if (addressInfo.balance_decimal < prizepool) {
    console.log("Insufficent funds");
    return res.status(400).json({ error: "Insufficent funds" });
  }
  logger.push(`Balance is positive`);
  //Create campaign

  //Create user if doesn't exist
  let user = await sql.getUser(address);
  if (user.length === 0) {
    user = await sql.createUser(address);
    console.log("New user created => ", user);
  }

  let newCamp = await sql.createCampaign({
    url: url,
    egg: hash,
    claim_amnt: claim_amnt,
    prizepool: prizepool,
    user_id: user.pop().id,
    status: 'pending'
  });
  newCamp = newCamp.pop();
  console.log('New BanEgg created => ', newCamp);
  //append campaign id to payment raw
  //Generate QR for payment
  //string - 'ban:ban_address?amount=amount_raw'

  const amountRaw = ban.getBananoDecimalAmountAsRaw(body.prizepool); // + newCamp.id;
  let amountSliced = appendCampaignIdToPayment(amountRaw, newCamp.id);

  const qrString = `ban:${banEggWallet}?amount=${amountSliced}`;
  //append to raws id of
  logger.push(`QR: ${qrString}`);
  QRCode.toDataURL(qrString, (err, url) => {
    //send to client
    console.log(logger.join(" "));
    return res.send({ qr: url, amountRaw: amountSliced, id: newCamp.id });
  });
});
app.post("/cancel-payment", async (req, res) => {
  const campId = req.body && req.body.id && sanitize(req.body.id);
  sql.updateCampaignStatus({ id: campId, status: 'cancelled'}).then( () => {
    return res.json({ message: 'BanEgg cancelled'});
  }).catch( e => {
    console.log(e);
    return res.status(400).json({ error: 'Couldn\'t cancel payment', dbMsg: e });
  })
});

app.post("/check-campaign-payment", async (req, res) => {
  const clientWallet = sanitize(req.body.address),
    paymentAmount = sanitize(req.body.paymentAmount),
    campId = sanitize(req.body.id);

  //Poll hotwallet transactions
  const pollingPaymentFinishedAt = new Date(
    new Date().setMinutes(new Date().getMinutes() + waitingForPaymentCountdown)
  );
  const interval = setInterval(awaitPayment, 10 * 1000);

  function awaitPayment() {
    console.log(
      "Awaiting payment. Minutes left: ",
      (pollingPaymentFinishedAt - new Date()) / 1000 / 60
    );
    
    sql.getCampaignById(campId).then( camp => {
      if(camp[0].status === 'cancelled') {
        clearInterval(interval);
        console.log('Payment cancelled by user', camp[0] && camp[0].id)
      }
    })

    if (pollingPaymentFinishedAt < new Date()) {
      console.log(
        "Polling timed out ",
        pollingPaymentFinishedAt.toLocaleString()
      );


      sql.updateCampaignStatus({ id: campId, status: "no_payment" })
        .then((sqlResult) => {
          clearInterval(interval);
          return res
            .status(400)
            .json({ error: "No payment recieved during 10 minutes" });
        });
    }
    console.log("Querying BanEgg wallet pending");
      
    ban.getAccountsPending([banEggWallet], 10).then((response) => {
      // look up for trx from clients wallet with amountSliced that has if of the campaign
      //Handle account has no pengind otherwise Object.keys fails
      if (typeof response.blocks === "string" && response.blocks.length === 0) {
        console.log("No pendings found");
        return;
      }
      const oPending = response.blocks[banEggWallet];
      const found = Object.keys(oPending).find(
        (key) => oPending[key] === paymentAmount
      );

      if (found) {
        console.log("Found payment, clearing polling");
        clearInterval(interval);

        //Recieve pending
        ban
          .receiveBananoDepositsForSeed(
            seed,
            1,
            "ban_1bananobh5rat99qfgt1ptpieie5swmoth87thi74qgbfrij7dcgjiij94xr" /* representative */
          )
          .then((banApiResult) => {
            console.log("Pending recieved");
            console.log(banApiResult);
            sql
              .updateCampaignStatusAndTrx({ id: campId, status: "hidden", hide_trx: banApiResult.receiveBlocks[0] })
              .then(async (sqlResult) => {
                const token = jwt.sign(
                  { user_id: sqlResult[0].user_id },
                  "s0m3-rand-0mt0-k3nn",
                  {
                    expiresIn: "24h",
                  }
                );
                
                await sql.saveUserToken(sqlResult[0].user_id, token);
                
                return res.send({
                  message: "Payment success. BanEgg is hidden",
                  token: token
                });
              });
          });
      }
    });
  }
});

app.post("/find", async (req, res) => {
  const campId = sanitize(req.body.id),
    clientWallet = sanitize(req.body.address.address),
    logger = [],
    bAddressValid = await ban.getBananoAccountValidationInfo(clientWallet).valid;
  if (!campId) {
    return res.status(400).json({ error: "No campaign id provided" });
  }
  logger.push(`Campaign ID: ${campId}`);

  if (!bAddressValid) {
    console.log("Invalid BAN Address");
    return res.status(400).json({ error: "Invalid BAN Address" });
  }
  logger.push(`Address valid: ${clientWallet}`);

  const campaign = await sql.getCampaignById(campId);
  if (campaign[0].claim_amnt <= 0) {
    return res
      .status(400)
      .json({ error: "This egg was already found by someone" });
  }

  if (campaign[0].status !== "hidden") {
    console.log(campaign[0]);
    return res.status(400).json({ error: "No active campaigns found" });
  }
  logger.push(`BanEgg is hidden`);

  //1. Send ban returns trx hash
  const trxHash = await ban
    .sendBananoWithdrawalFromSeed(
      seed,
      1,
      clientWallet,
      campaign[0].prizepool / campaign[0].claim_amnt
    )
    .catch((e) => console.log(e));
  if (!trxHash) {
    return res.status(400).json({ error: "Something went wrong" });
  }
  logger.push(`Trx hash: ${trxHash}`);
  //2. Decrease claim amount. Do we need it?! Probly not
  // const result = await sql.countClaim(campId);
  const campUpdated = await sql.updateCampaign({
    id: campId,
    url: campaign[0].url,
    egg: campaign[0].egg,
    claim_amnt: campaign[0].claim_amnt,
    prizepool: campaign[0].prizepool,
    user_id: campaign[0].user_id,
    status: "found",
    claimed_by: clientWallet,
    claimed_date: new Date().toISOString(),
    hide_trx: campaign[0].hide_trx,
    claim_trx: trxHash
  });
  return res.json({ status: campUpdated.status, hash: trxHash });
});

app.delete("/campaigns", async (req, res) => {
  const logger = [];
  const params = req.query;
  if (!params.id) {
    return res.status(400).json({ error: "Campaign id was not provided" });
  }
  logger.push(`Requested deletion of campaign ${params.id}`);

  const camp = await sql.getCampaignById(params.id);
  if (camp[0].status !== "found" && camp[0].status !== "hidden") {
    return res.status(400).json({ error: "BanEgg has invalid status. Contact support"});
  }
  if (camp[0].status === "found") {
    logger.push("Campaign is found. Deleted");
    console.log(logger.join(", "));
    return res.status(202).json({ message: 'Found BanEggs are preserved for statistics purposes'});
    //return res.json(await sql.deleteCampaign(params.id));
  }

  if (camp[0].status === "hidden") {
    //need to return funds here
   
    const eggCreatorWallet = await sql.getUserById(camp[0].user_id);
    if (!eggCreatorWallet) {
      logger.push("Couldn't find creator of the egg");
      console.log(logger.join(", "));
      return res.status(400).json("Couldn't find creator of the egg");
    }
    if (camp[0].prizepool === 0) {
      console.log("Nothing to send");
    }
    console.log(`Sending ${camp[0].prizepool}BAN to ${eggCreatorWallet[0].address}`);
    const trxHash = await ban
      .sendBananoWithdrawalFromSeed(
        seed,
        1,
        eggCreatorWallet[0].address,
        camp[0].prizepool
      )
      .catch((e) => console.log(e));

    if (!trxHash) {
      logger.push("Banano API error");
      console.log(logger.join(", "));
      return res.status(400).json({ error: "Banano API error" });
    }
    console.log(logger.join(", "));
    return res.json(await sql.deleteCampaign(params.id));
  }
});

app.put("/campaigns", async (req, res) => {
  const logger = [];
  const params = sanitize(req.query);
  const body = {};
  Object.keys(req.body).forEach(key => {
    body[key] = sanitize(req.body[key]);
  });

  if (!params.id) {
    return res.status(400).json({ error: "Campaign id was not provided" });
  }
  logger.push(`Requested update of campaign ${params.id}`);
  
  !body.id && (body.id = params.id);

  const camp = await sql.getCampaignById(params.id);
  if (camp[0].status === "found") {
    logger.push(`This BanEgg was found. No point to update it`);
    console.log(logger.join(", "));
    return res
      .status(400)
      .json({ error: "This BanEgg was found. No point to update it" });
  }

  return res.json(await sql.editCampaign(body));
});

// app.post("/campaigns-by-url", async (req, res) => {
//   const url = sanitize(req.body.url);
//   const result = await sql.getCampaignsByUrl(url);
//   res.json(result);
// });

app.post("/campaigns-by-url-hash", async (req, res) => {
  const url = sanitize(req.body.url);
  const hash = sanitize(req.body.hash);
  if (!url || !hash) {
    return res.status(400).json({ message: "No url or hash provided" });
  }
  const camps = await sql.getCampaignsByUrlEgg(url, hash);
  return res.json({ camps: camps });
});

app.get("/campaignsUrl", async (req, res) => {
  const campaigns = await sql.getAllCampaigns();
  res.json(campaigns);
});

app.post("/login", async (req, res) => {
  const clientWallet = sanitize(req.body.address);
  ban.getAccountInfo(clientWallet, true /* rep flag */).then((rep) => {
    const currentRep = rep.representative;
    let pollingCount = 10;
    const interval = setInterval(async function () {
      ban.getAccountInfo(clientWallet, true).then(async (info) => {
        console.log("Current rep is ", currentRep);
        console.log("Polling count", pollingCount);
        console.log("New rep is ", info.representative);
        if (pollingCount < 0) {
          clearInterval(interval);
          return res
            .status(400)
            .json({ error: "Polling change representative timed out" });
        }

        if (currentRep !== info.representative) {
          clearInterval(interval);
          const user = await sql.getUser(clientWallet);
          console.log(user);
          if (user.length === 0 ) {
            return res.status(403).json({ error: 'User is not registered in DB'})
          }
          const token = jwt.sign(
            { user_id: user[0].id },
            "s0m3-rand-0mt0-k3nn",
            {
              expiresIn: "24h",
            }
          );
          
          await sql.saveUserToken(user[0].id, token);
          return res.json({ token: token });
        }

        pollingCount--;
      });
    }, 10 * 1000);
  });
});

app.post("/hiddenHistory", auth, async (req, res) => {
  const address = sanitize(req.body.address);
  if (!req.body || !address) {
    res.status(400).json({ error: "No address provided" });
  }
  const camps = await sql.getUserCampaigns(address);
  return res.json(camps);
});

app.post("/foundEggs", async (req, res) => {
  const address = sanitize(req.body.address);
  if (!req.body || !address) {
    res.status(400).json({ error: "No address provided" });
  }
  const camps = await sql.getFoundEggs(address);
  return res.json(camps);
});

app.listen(process.env.PORT || 5000);

process.on("uncaughtException", (err) => {
  console.log(err);
});

function appendCampaignIdToPayment(raw, campId) {
  let sliced = raw.slice(0, -(campId + "").length);
  sliced = sliced.concat(campId);
  return sliced;
}
