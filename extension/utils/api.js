const api = {
  get: function (url) {
    return fetch(url)
      .then((res) => res.json())
      .catch((e) => {
        console.log(e);
      });
  },
  post: function (url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.log(e);
      });
  },
  getFragment: function (url) {
    return fetch(url)
      .then((res) => res.text())
      .catch((e) => {
        console.log(e);
      });
  },
  getHiddenHistory: function (token, address) {
    return fetch(`${apiHost}/hiddenHistory`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-access-token": token },
      body: JSON.stringify({ address: address }),
    }).then((res) => {
      if (res.status !== 200) {
        return res.json().then((json) => {
          throw new Error(json.error);
        });
      }
      return res.json();
    });
  },
  login: function (address) {
    return fetch(`${apiHost}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: address }),
    }).then((res) => res.json());
  },
};
