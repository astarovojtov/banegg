const apiHost = "https://banegg.herokuapp.com";
//const apiHost = "http://localhost:5000";
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
    if (options.class) {
      node.classList.add(options.class);
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
      document.querySelector(".overlay").classList.remove("invisible");
      document.querySelector(".loader").classList.remove("invisible");
      
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
            }).finally(() => {
              document.querySelector(".overlay").classList.add("invisible");
              document.querySelector(".loader").classList.add("invisible");
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
  const section = dom.byId("hidden-history");
  section.innerHTML = "";
  camps.length > 0 &&
    camps.forEach((camp) => {
      const card = dom.createElement("div", {
        class: "history-card",
        attr: {
          key: "data-camp-id",
          value: camp.id,
        },
      });

      const header = dom.createElement("h2", {
        html: `<span data-camp-url>${camp.url}</span><span>${camp.status}</span>`,
      });
      const hash = dom.createElement("p", {
        text: `Hash: ${camp.egg}`,
        attr: {
          key: "data-camp-hash",
          value: "",
        },
      });
      const bounty = dom.createElement("p", {
        text: `Bounty: ${camp.claim_amnt}`,
      });

      card.append(header);
      card.append(hash);
      card.append(bounty);

      if (camp.status === "found") {
        const date =
          new Date(camp.claimed_date).getTime() === 0
            ? "Not provided"
            : new Date(camp.claimed_date).toLocaleDateString();
        const claimedDate = dom.createElement("p", {
          text: `Claimed date: ${date}`,
        });
        const claimedBy = dom.createElement("p", {
          text: `Claimed by: ${camp.claimed_by}`,
        });

        card.append(claimedDate);
        card.append(claimedBy);
      }
      const deleteBtn = dom.createElement("button", { text: "Delete" });
      const editBtn = dom.createElement("button", { text: "Edit" });
      deleteBtn.addEventListener("click", function (e) {
        const card = e.target.parentElement;
        const popup = dom.createElement("div", { class: "popup" });
        const message = dom.createElement("p", {
          text: `Are you sure you want to delete this BanEgg?`,
        });
        const okBtn = dom.createElement("button", { text: "Delete" });
        const cancelBtn = dom.createElement("button", { text: "Cancel" });

        popup.append(message);
        popup.append(okBtn);
        popup.append(cancelBtn);
        card.append(popup);
        deleteBtn.remove();
        editBtn.remove();

        okBtn.addEventListener("click", function (e) {
          document.querySelector(".overlay").classList.remove("invisible");
          document.querySelector(".loader").classList.remove("invisible");

          api.delete(`${apiHost}/campaigns?id=${camp.id}`).then((res) => {
            if (res.status === 200) {
              popup.remove();
              card.remove();
              document.querySelector(".overlay").classList.add("invisible");
              document.querySelector(".loader").classList.add("invisible");
            }
          });
        });
        cancelBtn.addEventListener("click", function (e) {
          e.target.parentElement.remove();
          card.append(deleteBtn);
          card.append(editBtn);
        });
      });
      editBtn.addEventListener("click", function (e) {
        deleteBtn.remove();
        editBtn.remove();
        const popup = dom.createElement("div", { class: "popup" });
        const urlInput = dom.createElement("input", {
          attr: {
            key: "value",
            value: document.querySelector(
              `[data-camp-id='${camp.id}'] h2 span[data-camp-url]`
            ).innerText, //camp.url,
          },
        });
        urlInput.setAttribute("data-edit", "url");
        const eggInput = dom.createElement("input", {
          attr: {
            key: "value",
            value: document
              .querySelector(`[data-camp-id='${camp.id}'] p[data-camp-hash]`)
              .innerText.replace("Hash: ", ""), //camp.egg,
          },
        });
        eggInput.setAttribute("data-edit", "hash");
        const okBtn = dom.createElement("button", { text: "Save" });
        const cancelBtn = dom.createElement("button", { text: "Cancel" });
        okBtn.addEventListener("click", function (e) {
          document.querySelector(".overlay").classList.remove("invisible");
          document.querySelector(".loader").classList.remove("invisible");
          //update camp
          const newUrl = document.querySelector("[data-edit=url]").value;
          const newHash = document.querySelector("[data-edit=hash]").value;
          api
            .edit(`${apiHost}/campaigns?id=${camp.id}`, {
              url: newUrl,
              hash: newHash,
            })
            .then((response) => response.json())
            .then((r) => {
              if (!r.error) {
                document.querySelector(
                  `[data-camp-id='${camp.id}'] h2 span[data-camp-url]`
                ).innerText = r[0].url;
                document.querySelector(
                  `[data-camp-id='${camp.id}'] p[data-camp-hash]`
                ).innerText = `Hash: ${r[0].egg}`;
              }

              card.append(deleteBtn);
              card.append(editBtn);
              popup.remove();
            }).finally(() => {
              document.querySelector(".overlay").classList.add("invisible");
              document.querySelector(".loader").classList.add("invisible");
            });
        });
        cancelBtn.addEventListener("click", function (e) {
          e.target.parentElement.remove();
          card.append(deleteBtn);
          card.append(editBtn);
        });

        popup.append(urlInput);
        popup.append(eggInput);
        popup.append(okBtn);
        popup.append(cancelBtn);
        card.append(popup);
      });
      card.append(deleteBtn);
      card.append(editBtn);
      section.append(card);
    });
}
function renderFoundHistory(camps) {
  const section = dom.byId("hidden-history");
  section.innerHTML = "";
  camps.forEach((camp) => {
    const card = dom.createElement("div", {
      class: "history-card",
      attr: {
        key: "data-camp-id",
        value: camp.id,
      },
    });
    const header = dom.createElement("h2", {
      html: `<span>${camp.url}</span><span>#${camp.egg}</span>`,
    });
    const bounty = dom.createElement("p", {
      text: `Bounty: ${camp.claim_amnt}`,
    });

    card.append(header);
    card.append(bounty);

    const date =
      new Date(camp.claimed_date).getTime() === 0
        ? "Not provided"
        : new Date(camp.claimed_date).toLocaleDateString();
    const claimedDate = dom.createElement("p", {
      text: `Claimed date: ${date}`,
    });

    card.append(claimedDate);
    section.append(card);
  });
}
