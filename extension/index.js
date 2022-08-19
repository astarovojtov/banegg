const apiHost = 'https://banegg.herokuapp.com';
//const apiHost = 'http://localhost:5000'

chrome.storage.local.get("camps", ({ camps }) => {
  if (camps) { return; }
  api.get(`${apiHost}/campaignsUrl`)
    .then((camps) => {
      chrome.storage.local.set({ camps });
    });
});

dom.byId("settings").addEventListener("click", function (e) {
  api.getFragment("./fragments/settings.html")
    .then((fragmentString) => {
      const settings = dom.createElement("div", { html: fragmentString });
      settings.classList.add("settings");
      dom.byTagName('section').replaceChildren(settings);

      chrome.storage.local.get("address", ({ address }) => {
        if (address) {
          document.getElementById("address").value = address;
        }
      });

      const settingsRendered = new Event("settings-rendered");
      document.dispatchEvent(settingsRendered);
    });
});

dom.byId("home").addEventListener("click", function (e) {
    api.getFragment("./fragments/about.html")
      .then((fragmentString) => {
        const home = dom.createElement("div", { html: fragmentString });
        home.classList.add("home");

        dom.byTagName('section').replaceChildren(home);
      })
      .finally(() => {
        const aboutRendered = new Event("about-rendered");
        document.dispatchEvent(aboutRendered);
      });
  });

  document.addEventListener("about-rendered", function (e) {
    dom.byId("hide-ban-egg")
      .addEventListener("click", function (e) {
        api.getFragment("/fragments/campaign.html")
          .then((htmlString) => {
            const address = chrome.storage.local.get(
              "address",
              ({ address }) => {
                if (address) {
                  dom.byId("address").value = address;
                }
              }
            );
            const div = dom.createElement("div", { html: htmlString });
            dom.byTagName('section').replaceChildren(div);
            /******** Hide button listener *********/
            dom.byId("hide")
              .addEventListener("click", function (e) {
                const address = dom.byId("address").value;
                const url = dom.byId("url").value;
                const hash = dom.byId("hash").value;
                const prizepool = dom.byId("prizepool").value;

                chrome.storage.local.set({ address }); //store users wallet

                api.post(`${apiHost}/hide`, {
                    address: address,
                    url: new URL(url).host,
                    hash: hash,
                    prizepool: prizepool,
                    claim_amnt: 1,
                })
                  .then((res) => {
                    dom.byId("qrCode").classList.remove('invisible');
                    const img = dom.createElement("img", { attr: { key: 'src', value: res.qr }});
                    dom.byId("qrCode").append(img);

                    api.post(`${apiHost}/check-campaign-payment`, {
                        wallet: address,
                        paymentAmount: res.amountRaw,
                        id: res.id,
                    })
                      .then((res) => {
                        //delete qr
                        img && img.remove();
                        dom.byId("qrCode").classList.add('invisible');
                        const p = dom.createElement('p', { text: res.message });
                        dom.byId("payment-status").append(p);
                        dom.byId("payment-status").classList.remove('invisible');
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
        const messageStrip = document.createElement("p");
        messageStrip.innerText = "Settings saved";
        document.getElementsByTagName("section").append(p);
      });
  });

  fetch("/fragments/about.html")
    .then((res) => res.text())
    .then((string) => {
      const div = document.createElement("div");
      div.innerHTML = string;
      document.getElementsByTagName("section")[0].append(div);
    })
    .finally(function (e) {
      const aboutRendered = new Event("about-rendered");
      document.dispatchEvent(aboutRendered);
    });

  // The body of this function will be executed as a content script inside the
  // current page
  function setPageBackgroundColor() {
    chrome.storage.local.get("color", ({ color }) => {
      document.body.style.backgroundColor = color;
    });
  }

