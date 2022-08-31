// const apiHost = "https://banegg.herokuapp.com";
const apiHost = "http://localhost:5000";
const dom = {
  byId: function (id) {
    return document.getElementById(id);
  },
  createElement: function (sNodeType, options) {
    let node = document.createElement(sNodeType);
    if (options.text) {
      node.innerText = options.text;
    }
    if (options.attr) {
      node.setAttribute(options.attr.key, options.attr.value);
    }
    if (options.html) {
      node.innerHTML = options.html;
    }
    return node;
  },
};

chrome.storage.local.get("camps", ({ camps }) => {
  if (camps) {
    return;
  }
  api.get(`${apiHost}/campaignsUrl`).then((camps) => {
    chrome.storage.local.set({ camps });
  });
});

dom.byId("settings") &&
  dom.byId("settings").addEventListener("click", function (e) {
    api.getFragment("./fragments/settings.html").then((fragmentString) => {
      const settings = dom.createElement("div", { html: fragmentString });
      settings.classList.add("settings");
      dom.byId("banegg-content").replaceChildren(settings);

      chrome.storage.local.get("address", ({ address }) => {
        if (address) {
          document.getElementById("address").value = address;
        }
      });

      const settingsRendered = new Event("settings-rendered");
      document.dispatchEvent(settingsRendered);
    });
  });

dom.byId("home") &&
  dom.byId("home").addEventListener("click", function (e) {
    api
      .getFragment("./fragments/about.html")
      .then((fragmentString) => {
        const home = dom.createElement("div", { html: fragmentString });
        home.classList.add("home");

        dom.byId("banegg-content").replaceChildren(home);
      })
      .finally(() => {
        const aboutRendered = new Event("about-rendered");
        document.dispatchEvent(aboutRendered);
      });
  });

dom.byId("history") &&
  dom.byId("history").addEventListener("click", function (e) {
    api.getFragment("./fragments/history.html").then((fragmentString) => {
      const history = dom.createElement("div", { html: fragmentString });
      dom.byId("banegg-content").replaceChildren(history);
      const historyRendered = new Event("history-rendered");
      document.dispatchEvent(historyRendered);
    });
  });

document.addEventListener("history-rendered", function (e) {
  dom.byId("history-hidden-btn") &&
    dom.byId("history-hidden-btn").addEventListener("click", async (e) => {
      chrome.storage.local.get("token", ({ token }) => {
        chrome.storage.local.get("address", ({ address }) => {
          api
            .getHiddenHistory(token, address)
            .then((camps) => {
              //show camps
              dom.byId("history-message-strip").innerHTML = "";
              renderHiddenHistory(camps);
            })
            .catch((e) => {
              //fetch login
              dom.byId("history-message-strip").innerHTML =
                "Please specify ban address if you didn't yet and switch representative to authorize the action";
              dom.byId("history-hidden-btn").setAttribute("disabled", true);
              api
                .login(address)
                .then((res) => {
                  chrome.storage.local.set({ token: res.token });
                  dom.byId("history-message-strip").innerHTML =
                    "Authorized successfully. Please click button once again to check your BanEggs";
                  dom.byId("history-hidden-btn").removeAttribute("disabled");
                })
                .catch();
            });
        });
      });
    });

  dom.byId("history-found-btn") &&
    dom.byId("history-found-btn").addEventListener("click", function (e) {
      chrome.storage.local.get("address", ({ address }) => {
        api
          .post(`${apiHost}/foundEggs`, { address: address })
          .then((camps) => {
            renderFoundHistory(camps);
          })
          .catch((e) => console.log(e));
      });
    });
});

document.addEventListener("about-rendered", function (e) {
  dom.byId("hide-ban-egg") &&
    dom.byId("hide-ban-egg").addEventListener("click", function (e) {
      api.getFragment("/fragments/campaign.html").then((htmlString) => {
        const address = chrome.storage.local.get("address", ({ address }) => {
          if (address) {
            dom.byId("address").value = address;
          }
        });
        const div = dom.createElement("div", { html: htmlString });
        dom.byId("banegg-content").replaceChildren(div);
        /******** Hide button listener *********/
        dom.byId("hide").addEventListener("click", function (e) {
          document.querySelector(".overlay").classList.remove("invisible");
          document.querySelector(".loader").classList.remove("invisible");

          const address = dom.byId("address").value;
          let url = dom.byId("url").value;
          let hash = dom.byId("hash").value;
          const prizepool = dom.byId("prizepool").value;

          if (!address || !address.match("ban_")) {
            return;
          }
          if (!url || url.length < 4) {
            return;
          }

          if (!hash || hash.length < 4) {
            return;
          }

          if (!prizepool) {
            return;
          }

          hash = hash.trim();
          url = url.trim();
          url = url.match(/http:\/\/|https:\/\//) ? url : "http://" + url;

          chrome.storage.local.set({ address }); //store users wallet

          api
            .post(`${apiHost}/hide`, {
              address: address,
              url: new URL(url).host,
              hash: hash,
              prizepool: prizepool,
              claim_amnt: 1,
            })
            .then((res) => {
              //TODO: Need to check if status is ok before res.json
              //if (res.status === 'ok')
              document.querySelector(".overlay").classList.add("invisible");
              document.querySelector(".loader").classList.add("invisible");

              dom.byId("qrCode").classList.remove("invisible");
              const img = dom.createElement("img", {
                attr: { key: "src", value: res.qr },
              });
              dom.byId("qrCode").append(img);
              setPaymentCountDown();

              api
                .post(`${apiHost}/check-campaign-payment`, {
                  wallet: address,
                  paymentAmount: res.amountRaw,
                  id: res.id,
                })
                .then((res) => {
                  //delete qr
                  try {
                    img && img.remove();
                    dom.byId("qrCode").classList.add("invisible");
                    const p = dom.createElement("p", { text: res.message });
                    dom.byId("payment-status").append(p);
                    dom.byId("payment-status").classList.remove("invisible");
                  } catch (e) {
                    console.log(e);
                  }
                });
            });
        });
      });
    });
});

document.addEventListener("settings-rendered", function (e) {
  document
    .getElementById("save-settings")
    .addEventListener("click", function (e) {
      const address = document.getElementById("address").value;
      chrome.storage.local.set({ address });
      chrome.storage.local.remove("token");
      const messageStrip = document.createElement("p");
      messageStrip.innerText = "Settings saved";
      document.getElementById("banegg-content").append(messageStrip);
    });
});

fetch("/fragments/about.html")
  .then((res) => res.text())
  .then((string) => {
    const div = document.createElement("div");
    div.innerHTML = string;
    document.getElementById("banegg-content") &&
      document.getElementById("banegg-content").append(div);
  })
  .finally(function (e) {
    const aboutRendered = new Event("about-rendered");
    document.dispatchEvent(aboutRendered);
  });

function setPaymentCountDown() {
  const timeoutDate = new Date();
  timeoutDate.setMinutes(new Date().getMinutes() + 10);
  let timeLeft = timeoutDate.getTime() - new Date().getTime();
  console.log(timeLeft);

  const countdown = setInterval(() => {
    timeLeft = timeoutDate.getTime() - new Date().getTime();
    let mins = Math.floor((timeLeft / 1000 / 60) % 60);
    let secs = Math.floor((timeLeft / 1000) % 60);
    if (mins === 0 && secs === 0) {
      clearInterval(countdown);
    }
    document.querySelector(".mins").innerText = mins;
    document.querySelector(".secs").innerText = secs;
  }, 1000);
}
function renderHiddenHistory(camps) {
  /*
    claim_amnt: 1
    egg: "qe12qe"
    id: 3
    prizepool: 1
    status: "live"
    url: "https://yet-another-ban-faucet.herokuapp.com"
    user_id: 1
*/
  const section = dom.byId("hidden-history");
  section.innerHTML = "";
  camps.forEach((camp) => {
    const card = document.createElement("div");
    card.classList.add("history-card");
    card.setAttribute("data-camp-id", camp.id);
    const header = document.createElement("h2");
    header.innerHTML = `<span>${camp.url}</span><span>${camp.status}</span>`;

    // const url = document.createElement("p");
    // url.innerText = `Url: ${camp.url}`;

    const hash = document.createElement("p");
    hash.innerText = `Hash: ${camp.egg}`;

    const bounty = document.createElement("p");
    bounty.innerText = `Bounty: ${camp.claim_amnt}`;

    card.append(header);
    // card.append(url);
    card.append(hash);
    card.append(bounty);

    if (camp.status === "finished") {
      const claimedDate = document.createElement("p");
      const claimedBy = document.createElement("p");
      const date =
        new Date(camp.claimed_date).getTime() === 0
          ? "Not provided"
          : new Date(camp.claimed_date).toLocaleDateString();
      claimedDate.innerText = `Claimed date: ${date}`;
      claimedBy.innerText = `Claimed by: ${camp.claimed_by}`;

      card.append(claimedDate);
      card.append(claimedBy);
    }
    section.append(card);
  });
}
function renderFoundHistory(camps) {
  const section = dom.byId("hidden-history");
  section.innerHTML = "";
  camps.forEach((camp) => {
    const card = document.createElement("div");
    card.classList.add("history-card");
    card.setAttribute("data-camp-id", camp.id);
    const header = document.createElement("h2");
    header.innerHTML = `<span>${camp.url}</span><span>#${camp.egg}</span>`;

    const bounty = document.createElement("p");
    bounty.innerText = `Bounty: ${camp.claim_amnt}`;

    card.append(header);
    card.append(bounty);

    const claimedDate = document.createElement("p");

    const date =
      new Date(camp.claimed_date).getTime() === 0
        ? "Not provided"
        : new Date(camp.claimed_date).toLocaleDateString();
    claimedDate.innerText = `Claimed date: ${date}`;
    card.append(claimedDate);
    section.append(card);
  });
}
