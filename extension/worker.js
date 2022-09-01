let color = "#3aa757";
const apiHost = "https://banegg.herokuapp.com";
//const apiHost = "http://localhost:5000";
chrome.runtime.onInstalled.addListener(() => {});

chrome.runtime.onStartup.addListener(async () => {
  console.log("Starting up");
  //query all campaigns and save in storage to minify request load on DB
  fetch(`${apiHost}/campaignsUrl`)
    .then((res) => res.json())
    .then((camps) => {
      chrome.storage.local.set({ camps });
    });
});

chrome.tabs.onUpdated.addListener(async (id, changeInfo, tab) => {
  if (!!changeInfo.status && changeInfo.status !== "complete" && tab.active) {
    return;
  }
  if (!changeInfo.status || !!changeInfo.favIconUrl) {
    return;
  }

  let host = "";
  try {
    host = tab && new URL(tab.url).host.replace("www.", "");
    hash = tab && new URL(tab.url).hash.replace("#", "");
  } catch (e) {
    return;
  }

  if (!host || !hash) {
    return;
  }

  chrome.storage.local.get("camps", ({ camps }) => {
    if (!camps || camps.length === 0) {
      fetch(`${apiHost}/campaignsUrl`)
        .then((res) => res.json())
        .then((camps) => {
          chrome.storage.local.set({ camps });
        });
    }

    fetch(`${apiHost}/campaigns-by-url-hash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: host, hash: hash }),
    })
      .then((res) => {
        console.log(res);
        if (!res.ok) {
          return Promise.reject(res);
        }
        return res.json();
      })
      .then((camps) => {
        if (!camps.camps || camps.camps.length !== 1) {
          return;
        }

        chrome.notifications.create(`campaign-${camps.camps[0].id}`, {
          type: "basic",
          message: "You have found a BanEgg! Click to grab",
          title: "FOUND!",
          iconUrl: "/icons/eggs.png",
          buttons: [{ title: "Grab" }, { title: "Ignore" }],
        });
      })
      .catch((response) => {
        const statusText = response.statusText;
        response.json().then((e) => {
          console.log(statusText, e.message);
        });
      });
  });
});
chrome.notifications.onButtonClicked.addListener(
  async (notificationId, buttonIndex) => {
    //Ignore clicked
    if (buttonIndex === 1) {
      chrome.notifications.clear(notificationId);
      return;
    }

    //send request to claim tha found egg
    const address = await chrome.storage.local.get("address");

    if (!address) {
      chrome.notifications.create(
        `campaign-claim-${notificationId.split("-").pop()}`,
        {
          type: "basic",
          message: `Ban addres was not provided. Go to settings to configure your address first`,
          title: "CLAIM FAILED!",
          iconUrl: "/icons/eggs.png",
        }
      );
      return;
    }

    fetch(`${apiHost}/find`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: notificationId.split("-").pop(),
        address: address,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (!!res.hash) {
          chrome.notifications.create(
            `campaign-claim-${notificationId.split("-").pop()}`,
            {
              type: "basic",
              message: `BanEgg reward sent. Transaction hash ${res.hash}`,
              title: "CLAIMED!",
              iconUrl: "/icons/eggs.png",
            }
          );
        }
      });
  }
);

chrome.tabs.onActivated.addListener(async () => {});

async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}
