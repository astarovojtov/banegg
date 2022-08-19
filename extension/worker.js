let color = "#3aa757";
const apiHost = 'https://banegg.herokuapp.com';
//const apiHost = 'http://localhost:5000'
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ color });
  console.log("Default background color set to %cgreen", `color: ${color}`);
});

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
  if (changeInfo.status && changeInfo.status !== "completed") {
    //return;
  }

  let host = "";
  try {
    host = tab && new URL(tab.url).host;
    hash = tab && new URL(tab.url).hash.replace("#", "");
  } catch (e) {
    return;
  }

  chrome.storage.local.get("camps", ({ camps }) => {
    if (!camps || camps.length === 0) {
      return;
    }

    fetch(`${apiHost}/campaigns-by-url-hash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: host, hash: hash }),
    })
      .then((res) =>{ 
        if (!res.ok) { throw new Error('Something bad happened')}
        return res.json()
      })
      .then((camps) => {
        if (!camps.camps || camps.camps.length !== 1) {
          return;
        }
        console.log("Found! ", camps.camps[0]);
        
        chrome.notifications.create(
          `campaign-${camps.camps[0].id}`,
          {
            type: "basic",
            message: "You have found a BanEgg! Click to grab",
            title: "FOUND!",
            iconUrl: "/icons/eggs.png",
            buttons: [{ title: "Grab" }, { title: "Ignore" }],
          },
          () => {
            console.log("notification created");
          }
        );
      })
      .catch((e) => console.log(e));
  });
});
chrome.notifications.onButtonClicked.addListener(
  (notificationId, buttonIndex) => {
    console.log(`Button ${buttonIndex} clicked`);
    if (buttonIndex !== 0) { return; }
      
      //send request to claim tha found egg
      const address = await chrome.storage.local.get('address');
      if (!address ) {
        console.log('Address was not provided');
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
            console.log("Claimed!");
            chrome.notifications.create(
              `campaign-claim-${notificationId.split("-").pop()}`,
              {
                type: "basic",
                message: "BanEgg reward sent",
                title: "CLAIMED!",
                iconUrl: "/icons/eggs.png",
              }
            );
          }
        });
    }
);
// chrome.notifications.onClicked.addListener((notificationId) => {
//   console.log(`Notifiaction ${notificationId} clicked`);
// });
chrome.tabs.onActivated.addListener(async () => {});

async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}
